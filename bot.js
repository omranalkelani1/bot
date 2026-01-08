const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ================== CONFIG ==================
const BOT_TOKEN = '8451392820:AAGYDwYGIgiVUK81BK2Q3A0WppaHdMFnS-s';
const CHECK_CHANNEL = '-1003595755056';   // قناة المراجعة (قبول / رفض)
const OFFERS_CHANNEL = '@usdtB2026';      // قناة نشر العروض
const STORAGE_FILE = './storage.json';

// ================== INIT ==================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.setMyCommands([
  {
    command: 'start',
    description: 'بدء استخدام البوت'
  }
]);
console.log('✅ Bot is running');

// ================== STORAGE ==================
let userStates = fs.existsSync(STORAGE_FILE)
  ? JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'))
  : {offerSeq: 0 };

function saveStorage() {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(userStates, null, 2));
}

// ================== CONSTANTS ==================
const callbackTypes = {
  ways: 'ways',
  sellOrBuy: 'sellOrBuy',
  transform_way: 'transform_way',
  approve: 'approve',
  reject: 'reject',
  confirm_send: 'confirm_send',
  cancel_offer: 'cancel_offer',
  done: 'done',
};
const categories = {
  bronze: '🥉 برونزي',
  silver: '🥈 فضي',
  gold: '🥇 ذهبي',
  royal: '👑 ملكي'
};
const transform_way = {
  haram: 'الهرم',
  fuad: 'الفؤاد',
  shamDolar: '(دولار) شام كاش',
  shamSy: '(سوري) شام كاش',
  mtn: 'ام تي ان كاش',
  syriatel: 'سيرياتل كاش',
  kadmos: 'القدموس'
};

const status = {
  pending: 'انتظار موافقة المشرف',
  approved: 'مقبول ',
  rejected: 'مرفوض'
}
//#region /start ==================
bot.onText(/\/start/, async (msg) => {

  ////

  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const member = await bot.getChatMember(OFFERS_CHANNEL, userId);
    if (!['member', 'administrator', 'creator'].includes(member.status)) {
      return bot.sendMessage(chatId, `❌ يجب الانضمام للقناة: ${OFFERS_CHANNEL}`, {
        parse_mode: 'HTML'
      });
    }

    if (!userStates[chatId]) {
      userStates[chatId] = {
        phone: null,
        category: categories.bronze,
        offers: [],
        current: { step: 'askPhone' }
      };
      saveStorage();
    }

    if (!userStates[chatId].phone) {
      return bot.sendMessage(chatId, '📱 الرجاء مشاركة رقم هاتفك', {
        reply_markup: {
          keyboard: [[{ text: 'مشاركة رقمي', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true
        },
      });
    }

    sendWelcomeMessage(chatId, msg);
  } catch (e) {
    console.error(e.message);
    bot.sendMessage(chatId, '❌ تأكد أنك مشترك بالقناة والبوت مشرف');
  }
});

// ================== MESSAGE FLOW ==================
bot.on('message', (msg) => {

  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  if (!userStates[chatId]) return;

  const state = userStates[chatId].current;

  if (state.step === 'askPhone' && msg.contact) {
    userStates[chatId].phone = msg.contact.phone_number;
    userStates[chatId].current = {};
    saveStorage();
    return sendWelcomeMessage(chatId, msg);
  }

  if (state.step === 'askPrice') {
      if (!isValidNumber(msg.text)) {
    return bot.sendMessage(chatId, '❌ الرجاء إدخال رقم صحيح للسعر');
  }

    state.price = msg.text;
    state.step = 'askMinQuantity';
    saveStorage();
    return bot.sendMessage(chatId, 'أدخل الحد الأدنى للكمية');
  }

  if (state.step === 'askMinQuantity') {
      if (!isValidNumber(msg.text)) {
    return bot.sendMessage(chatId, '❌ الرجاء إدخال رقم صحيح للحد الأدنى');
  }

    state.minQuantity = msg.text;
    state.step = 'askMaxQuantity';
    saveStorage();
    return bot.sendMessage(chatId, 'أدخل الحد الأعلى للكمية');
  }

  if (state.step === 'askMaxQuantity') {
      if (!isValidNumber(msg.text)) {
    return bot.sendMessage(chatId, '❌ الرجاء إدخال رقم صحيح للحد الأعلى');
  }

    state.maxQuantity = msg.text;
    state.step = 'askPayment';
    saveStorage();

    return bot.sendMessage(chatId, 'اختر طريقة الدفع', {
      reply_markup: {
        inline_keyboard: Object.entries(transform_way).map(([k, v]) => [
          { text: v, callback_data: JSON.stringify({ type: callbackTypes.transform_way, data: k }) }
        ])
      }
    });
  }
});

//#region CALLBACK ==================
bot.on('callback_query', async (query) => {
  let payload;
  try { payload = JSON.parse(query.data); } catch { return; }

  const chatId = query.message.chat.id;

  // ===== CONFIRM SEND =====
  if (payload.type === callbackTypes.confirm_send) {
    return sendOfferForReview(chatId, query.message.message_id);
  }

  // ===== CANCEL OFFER =====
  if (payload.type === callbackTypes.cancel_offer) {
    userStates[chatId].current = {};
    saveStorage();

    return bot.editMessageText(
      '❌ تم إلغاء إنشاء العرض',
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );
  }
  // ===== USER FLOW =====
  if (payload.type === callbackTypes.ways && payload.data === 'create_usdt') {
    return bot.editMessageText('اختر نوع العملية', {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'بيع USDT 🔴', callback_data: JSON.stringify({ type: callbackTypes.sellOrBuy, data: 'sell' }) }],
          [{ text: 'شراء USDT 🟢', callback_data: JSON.stringify({ type: callbackTypes.sellOrBuy, data: 'buy' }) }],

        ]
      }
    });
  }

  if (payload.type === callbackTypes.sellOrBuy) {
    const state = userStates[chatId].current;
    state.operation = payload.data === 'sell' ? 'بيع' : 'شراء';
    state.step = 'askPrice';
    saveStorage();
    return bot.sendMessage(chatId, 'أدخل السعر');
  }

  if (payload.type === callbackTypes.transform_way) {
    const state = userStates[chatId].current;
    state.transform_way = payload.data;
    saveStorage();

    return bot.sendMessage(
      chatId,
      formatPreview(userStates[chatId].current),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ إرسال العرض للمشرف', callback_data: JSON.stringify({ type: callbackTypes.confirm_send }) }],
            [{ text: '❌ إلغاء العرض', callback_data: JSON.stringify({ type: callbackTypes.cancel_offer }) }]
          ]
        }
      }
    );
  }

  //#region APPROVE =====
  // if (payload.type === callbackTypes.approve) {
  //   const { userId, offerId } = payload;
  //   const user = userStates[userId];
  //   if (!user) return;

  //   const offer = user.offers.find(o => o.id === offerId);
  //   if (!offer || offer.status !== 'pending') return;

  //   offer.status = 'approved';
  //   saveStorage();

  //   // تعديل رسالة قناة التشييك
  //   await bot.editMessageText(
  //     formatOffer(user, offer, '\n✅ تم قبول العرض'),
  //     {
  //       chat_id: query.message.chat.id,
  //       message_id: query.message.message_id
  //     }
  //   );
  //   await bot.sendMessage(OFFERS_CHANNEL, formatOffer(user, offer));
  //   await bot.sendMessage(userId, '✅ تم قبول عرضك ونشره');

  //   return bot.answerCallbackQuery(query.id, { text: 'تم نشر العرض' });
  // }

  if (payload.type === callbackTypes.approve) {
    const { userId, offerId } = payload;
    const user = userStates[userId];
    if (!user) return;

    const offer = user.offers.find(o => o.id === offerId);
    if (!offer || offer.status !== 'pending') return;

    offer.status = 'approved';
    saveStorage();

    await bot.editMessageText(
      formatOffer(user, offer, '\n✅  تم قبول العرض'),
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '✅ تم التنفيذ',
              callback_data: JSON.stringify({
                type: callbackTypes.done,
                userId,
                offerId
              })
            }
          ]]
        }
      }
    );

    await bot.sendMessage(userId, `
      ✅ تم قبول عرضك ونشره
      رقم العرض هو : ${offerId}
      `);
    const pubMsg = await bot.sendMessage(
      OFFERS_CHANNEL,
      formatOffer(user, offer),
      { parse_mode: 'HTML' }
    );

    offer.publicMessageId = pubMsg.message_id;
    saveStorage();
    return bot.answerCallbackQuery(query.id);
  }


  // ====== DONE ========
  if (payload.type === callbackTypes.done) {
    const { userId, offerId } = payload;
    const user = userStates[query.from.id]

    if (!user) return;

    const offer = user.offers.find(o => o.id === offerId);
    if (!offer || offer.doneSellOffer) return;

    offer.doneSellOffer = true;
    saveStorage();

    const text = formatOffer(user, offer, '', true);

    // قناة التشييك
    await bot.editMessageText(text, {
      chat_id: CHECK_CHANNEL,
      message_id: offer.checkMessageId,
      parse_mode: 'HTML'
    });

    // قناة العروض
    if (offer.publicMessageId) {
      await bot.editMessageText(text, {
        chat_id: OFFERS_CHANNEL,
        message_id: offer.publicMessageId,
        parse_mode: 'HTML'
      });
    }


    await bot.sendMessage(userId, `
      ☑️ تم تنفيذ العرض بنجاح
      رقم العرض هو : ${offer.id}
      `);

    let count = 0
    user.offers.forEach(element => {
      if (element.doneSellOffer) count++;

    });

    switch (count) {
      case 5:
        user.category = categories.silver
        break;
      case 15:
        user.category = categories.gold
        break;
      case 30:
        user.category = categories.royal
        break;

      default:

        return
    }
    saveStorage()
    console.log('ehho');

    return bot.answerCallbackQuery(query.id, { text: 'تم التنفيذ' });
  }

  //#region  REJECT =====
  if (payload.type === callbackTypes.reject) {
    const { userId, offerId } = payload;
    const user = userStates[userId];
    if (!user) return;

    const offer = user.offers.find(o => o.id === offerId);
    if (!offer || offer.status !== 'pending') return;

    offer.status = 'rejected';
    saveStorage();
    // تعديل رسالة قناة التشييك
    await bot.editMessageText(
      formatOffer(user, offer, '\n❌ تم رفض العرض'),
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
      }
    );
    await bot.sendMessage(userId, '❌ تم رفض عرضك');
    return bot.answerCallbackQuery(query.id, { text: 'تم رفض العرض' });
  }

  //#region  MANAGE_OFFERS ========
  if (payload.type === 'manage_offers') {
    const user = userStates[query.from.id];
    if (!user || !user.offers.length) {
      return bot.answerCallbackQuery(query.id, { text: 'لا توجد عروض' });
    }
    const CurrentOffers = user.offers.filter(ele => !ele.doneSellOffer)
    console.log('c', CurrentOffers);

    CurrentOffers.forEach(o => {
      const message = formatPreview(o, `
        📩 العرض رقم: ${o.id}
        حالة العرض : ${status[o.status]}
        `)

      bot.sendMessage(chatId, message, {

        reply_markup: { inline_keyboard: [[{ text: '🗑 حذف', callback_data: JSON.stringify({ type: 'delete_offer', offerId: o.id }) }]] }
      });
    });


  }
  //  =========== VIEW_OFFERS =============
  if (payload.type === 'view_offer') {
    const user = userStates[query.from.id];
    const offer = user.offers.find(o => o.id === payload.offerId);
    if (!offer) return;

    return bot.editMessageText(
      formatOffer(user, offer),
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              // { text: '✏️ تعديل', callback_data: JSON.stringify({ type: 'edit_offer', offerId: offer.id }) },
              { text: '🗑 حذف', callback_data: JSON.stringify({ type: 'delete_offer', offerId: offer.id }) }
            ],
            [
              { text: '⬅️ رجوع', callback_data: JSON.stringify({ type: 'manage_offers' }) }
            ]
          ]
        }
      }
    );
  }

  //#region DELETE ============
  if (payload.type === 'delete_offer') {
    const user = userStates[query.from.id];
    const index = user.offers.findIndex(o => o.id === payload.offerId);

    if (index === -1) return;

    const offer = user.offers[index];

    // if (offer.status !== 'pending') {
    //   return bot.answerCallbackQuery(query.id, {
    //     text: 'لا يمكن حذف عرض مقبول أو مرفوض'
    //   });
    // }

    user.offers.splice(index, 1);
    saveStorage();

    const text = formatOffer(user, offer, 'تم إلغاء العرض ❌', true);

    // قناة التشييك
    await bot.editMessageText(text, {
      chat_id: CHECK_CHANNEL,
      message_id: offer.checkMessageId,
      parse_mode: 'HTML'
    });

    // قناة العروض
    if (offer.publicMessageId) {
      await bot.editMessageText(text, {
        chat_id: OFFERS_CHANNEL,
        message_id: offer.publicMessageId,
        parse_mode: 'HTML'
      });
    }
    return bot.editMessageText('🗑 تم حذف العرض بنجاح', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  }

  if (payload.type === 'profile') {
    const chatId = query.from.id
  bot.sendMessage(
  chatId,
  `اهلا يا : ${query.from?.first_name}
إن فئتك هي ${userStates[chatId].category}

مع العلم أن ترتيب الفئات كالآتي :
🥉 برونزي : لجميع المستخدمين
🥈 فضي : عند اتمام 5 معاملات 
🥇 ذهبي : عند اتمام 15 معاملات 
👑 ملكي : عند اتمام 30 معاملات
`,
  {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '⬅️ رجوع',
          callback_data: JSON.stringify({ type: 'back_profile' })
        }
      ]]
    }
  }
);

  }

  if (payload.type === 'back_profile') {
  await bot.deleteMessage(
    query.message.chat.id,
    query.message.message_id
  );

  return bot.answerCallbackQuery(query.id);
}

  // ======== EDIT ==========
  // if (payload.type === 'edit_offer') {
  //   const user = userStates[query.from.id];
  //   const offer = user.offers.find(o => o.id === payload.offerId);
  //   if (!offer) return;

  //   if (offer.status !== 'pending') {
  //     return bot.answerCallbackQuery(query.id, {
  //       text: 'لا يمكن تعديل عرض تم قبوله'
  //     });
  //   }

  //   user.current = {
  //     operation: offer.operation,
  //     step: 'askPrice',
  //     editingOfferId: offer.id
  //   };

  //   saveStorage();

  //   return bot.sendMessage(query.from.id, '✏️ أدخل السعر الجديد');
  // }

});

//#region FUNCTIONS ==================
function isValidNumber(value) {
  return !isNaN(value) && value !== '';
}

async function sendOfferForReview(chatId, messageId) {
  console.log(chatId);
  
  const user = userStates[chatId];
  if (!user) return;
  userStates.offerSeq = (userStates.offerSeq || 0) + 1;
  const offerId = userStates.offerSeq;

  const offer = {
    id: offerId,
    ...user.current,
    status: 'pending',
    userId: chatId,
    doneSellOffer: false,
    checkMessageId: null,   // قناة التشييك
    publicMessageId: null
  };

  user.offers.push(offer);
  user.current = {};

  console.log(formatOffer(user,offer));
  
  const sent = await bot.sendMessage(CHECK_CHANNEL, formatOffer(user,offer), {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ قبول', callback_data: JSON.stringify({ type: callbackTypes.approve, userId: chatId, offerId }) },
        { text: '❌ رفض', callback_data: JSON.stringify({ type: callbackTypes.reject, userId: chatId, offerId }) }
      ]]
    },
    parse_mode: 'HTML'
  });
  offer.checkMessageId = sent.message_id;
  bot.editMessageText('⏳ تم إرسال عرضك للمراجعة', {
    chat_id: chatId,
    message_id: messageId
  });
  saveStorage();
}

function formatOffer(user, offer, statusText = '', isCenterLine = false) {
  const text = `
📩 العرض رقم: ${offer.id}

🔁 العملية: ${offer.operation} USDT
📦 الكمية: ${offer.minQuantity} الى ${offer.maxQuantity}
💰 السعر: ${offer.price}
💳 طريقة الدفع: ${transform_way[offer.transform_way]}
👤 فئة العميل: ${user.category}

${statusText}
`;

  // إذا تم تنفيذ العرض → شطب النص
  return isCenterLine ? `<s>${text}</s>` : text;
}
function sendWelcomeMessage(chatId, msg) {
  bot.sendMessage(chatId, ` أهلاً بك يا ${msg.chat.first_name} في بوت USDTSY للوساطة المالية — منصتك الذكية للتداول السريع والآمن

    🛍 الآن أصبح بإمكانك بيع وشراء USDT مقابل كل وسائل الدفع السورية المتاحة وبإمكانك ايضا بيع وشراء شام كاش دولار بكل سهولة
    
    ⚡️ واجهة سلسة، عروض مباشرة، وصفقات تنجز بثوانٍ
    🛡️ أمان، شفافية، وتجربة تداول مصممة خصيصاً لك
    
    🔄 تنقّل بين العملات، اغتنم الفرص، وكن دائماً في قلب السوق
    
    ⌚️ انطلق الآن وكن جزءاً من مجتمع يعرف قيمة الوقت والقرار   `, {
    reply_markup: {
      inline_keyboard: [[
        { text: '➕ إنشاء عرض USDT', callback_data: JSON.stringify({ type: callbackTypes.ways, data: 'create_usdt' }) },
      ], [
        { text: '📂 إدارة عروضي', callback_data: JSON.stringify({ type: 'manage_offers' }) },
        { text: '😎 ملفي الشخصي', callback_data: JSON.stringify({ type: 'profile' }) }
      ]
      ]
    }
  });
}

function formatPreview(offer, title = "📋 *تأكيد بيانات العرض*") {
  const o = offer;

  return `
${title}

🔁 العملية: ${o.operation} USDT
💰 السعر: ${o.price}
📦 الكمية: ${o.minQuantity}  الى ${o.maxQuantity}
💳 طريقة الدفع: ${transform_way[o.transform_way]}

`;
}
