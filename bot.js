// ================== COMMANDS ==================
// /tradeStatus
// /StartNow
// /StopNow
// /StopAcceptTrade
// /cancelTrade
// /cancelOffer
// /removeOffer
// /buyerCall

const TelegramBot = require('node-telegram-bot-api');
// const fs = require('fs');
// 
// ================== CONFIG ==================
// const BOT_TOKEN = '8499337359:AAG-gTmEKDZJFF8bRv-YqE1SzHdmDk9f7mQ';
// const CHECK_CHANNEL = '-1003595755056';   // قناة المراجعة (قبول / رفض)

// ================= TEST CHANNELS ==============
const BOT_TOKEN = '8463367526:AAHV71-_aMK59WD2DXYAuo42d6FQaQ5386o';
const CHECK_CHANNEL = '-1003513182240';   // قناة المراجعة (قبول / رفض)
const OFFERS_CHANNEL = '-1001509487183';      //   قناة نشر العروض  alkelani p2p
// const OFFERS_CHANNEL = '-1003525097551';      // قناة نشر العروض omran offers
const APPROVE_REJECT_CHANNEL = '-1003505235269';      // قناة نشر العروض

// Photo IDs for start/stop announcements (from env)
const START_BOT_PHOTO = 'AgACAgQAAxkBAAIIUGl0Lub3v4UR_lQ8GOK1-7wy4QsSAAJIC2sbF3WhU19jqCKwW8bzAQADAgADeQADOAQ';
const STOP_BOT_PHOTO = 'AgACAgQAAxkBAAIIXGl0MeFscjjdJnAyfoY3oCsvutt7AAJLC2sbF3WhU2NIWAxFbmYGAQADAgADeAADOAQ';
// const STOP_BOT_PHOTO = 'AgACAgQAAxkBAAIIUWl0LyWC22TsQlMnYNfwqMEU5tFhAAJJC2sbF3WhU1rnioZz7-O_AQADAgADbQADOAQ';

// const OFFERS_CHANNEL = '@usdtB2026';      // قناة نشر العروض
// const STORAGE_FILE = './storage.json';

// ================== INIT ==================
//#region ENV

// const fetch = (...args) =>
//   import('node-fetch').then(({ default: fetch }) => fetch(...args));
// GITHUB_TOKEN = "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"
// GITHUB_OWNER = "omranalkelani1"
// GITHUB_REPO = "bot"
// GITHUB_BRANCH = "main"
// GITHUB_FILE = "storage.json"
const GH = {
  // owner: GITHUB_OWNER,
  // repo: GITHUB_REPO,
  // branch: GITHUB_BRANCH || 'main',
  // token: GITHUB_TOKEN,
  // file: GITHUB_FILE || 'storage.json'
  owner: process.env.GITHUB_OWNER, 
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH || 'main',
  token: process.env.GITHUB_TOKEN,
  file: process.env.GITHUB_FILE || 'storage.json'
};

const GH_API = `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${GH.file}`;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.setMyCommands([
  {
    command: 'start',
    description: 'بدء استخدام البوت'
  }
]);

// expose admin commands to start/stop the bot
bot.setMyCommands([
  { command: 'start', description: 'بدء استخدام البوت' },
  // { command: 'StartNow', description: 'تشغيل البوت (مشرفين القناة)' },
  // { command: 'StopNow', description: 'إيقاف البوت (مشرفين القناة)' },
  // { command: 'cancelTrade', description: 'إلغاء صفقة بواسطة رقم المعاملة (مثال: /cancelTrade22)' }
]);
console.log('✅ Bot is running');

// Wrap editMessageText globally to avoid crashing when message was already deleted
// (Telegram returns 400: message to edit not found). This will log and ignore that case.
{
  const _origEdit = bot.editMessageText.bind(bot);
  bot.editMessageText = async (text, options = {}) => {
    try {
      return await _origEdit(text, options);
    } catch (err) {
      const desc = err?.response?.body?.description || err?.message || '';
      if (typeof desc === 'string' && desc.toLowerCase().includes('message to edit not found')) {
        console.warn('Ignored editMessageText error: message to edit not found', { text, options });
        return null;
      }
      console.error('editMessageText failed', err && err.response ? err.response.body : err);
      throw err;
    }
  };
}

// ================== STORAGE ==================


let userStates = { offerSeq: 0 };

(async () => {
  userStates = await loadStorage();
  console.log('✅ Storage loaded from GitHub', userStates);
  // ensure default bot state
  if (typeof userStates.botEnabled === 'undefined') userStates.botEnabled = true;
})();



// function saveStorage() {
//   fs.writeFileSync(STORAGE_FILE, JSON.stringify(userStates, null, 2));
// }

// ================== CONSTANTS ==================
const TradeSteps = {
  CONFIRM_QUANTITY: 'confirm_quantity',

  SELLER_UPLOAD: 'seller_upload',
  SELLER_DONE_UPLOAD: 'seller_done_upload',
  ADMIN_CONFIRM_SELLER: 'admin_confirm_seller',
  SELLER_PAYMENT_INFO: 'seller_payment_info',

  BUYER_UPLOAD: 'buyer_upload',
  BUYER_DONE_UPLOAD: 'buyer_done_upload',
  SELLER_CONFIRM_BUYER: 'seller_confirm_buyer',
  BUYER_PAYMENT_INFO_TO_ADMIN: 'buyer_payment_info_toAdmin',

  ADMIN_UPLOAD: 'admin_upload',
  FINALIZE_TRADE: 'finalize_trade',
};
const TradeStepsAR = {
  [TradeSteps.CONFIRM_QUANTITY]: 'تأكيد الكمية',

  [TradeSteps.SELLER_UPLOAD]: '📤 البائع يرفع الإثبات',
  [TradeSteps.SELLER_DONE_UPLOAD]: '✅ البائع أنهى الرفع',
  [TradeSteps.ADMIN_CONFIRM_SELLER]: '🛂 بانتظار تأكيد الأدمن',
  [TradeSteps.SELLER_PAYMENT_INFO]: '💳 بيانات دفع البائع',

  [TradeSteps.BUYER_UPLOAD]: '📤 المشتري يرفع الإثبات',
  [TradeSteps.BUYER_DONE_UPLOAD]: '✅ المشتري أنهى الرفع',
  [TradeSteps.SELLER_CONFIRM_BUYER]: '🛂 البائع يؤكد إثبات المشتري',
  [TradeSteps.BUYER_PAYMENT_INFO_TO_ADMIN]: '💳 بيانات المشتري للأدمن',

  [TradeSteps.ADMIN_UPLOAD]: '📸 الأدمن يرفع الإثبات النهائي',
  [TradeSteps.FINALIZE_TRADE]: '🎉 تمت الصفقة',
};

const callbackTypes = {
  ways: 'ways',
  start_trade: 'start_trade',
  sellOrBuy: 'sellOrBuy',
  transform_way: 'transform_way',
  approve: 'approve',
  reject: 'reject',
  confirm_send: 'confirm_send',
  confirm_seller_payment_info: 'confirm_seller_payment_info',
  confirm_buyer_payment_info: 'confirm_buyer_payment_info',
  seller_accept_trade: 'seller_accept_trade',
  seller_reject_trade: 'seller_reject_trade',
  cancel_trade: 'cancel_trade',
  edit_offer: 'edit_offer',
  edit_price: 'edit_price',
  edit_quantity: 'edit_quantity',
  edit_transform_way: 'edit_transform_way',
  submit_edit: 'submit_edit',
  admin_approve_edit: 'admin_approve_edit',
  admin_reject_edit: 'admin_reject_edit',
  cancel_offer: 'cancel_offer',
  done: 'done',
  remove_offer: 'remove_offer',
  delete_offer: 'delete_offer',
  verify_me: 'verify_me',
  verify_confirm: 'verify_confirm',
  verify_reject: 'verify_reject',
  verify_approve: 'verify_approve'
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
bot.onText(/\/removeOffer(\d+)/, async (msg, match) => {

  // if (!ADMINS.includes(adminId)) {
  //   return bot.sendMessage(adminId, '❌ هذا الأمر للمشرفين فقط');
  // }

  const offerNum = Number(match[1]);

  if (!offerNum) {
    console.log('done have offer id in remove offer command');
    return
  }

  const removed = await removeOfferByAdmin(offerNum);

  if (!removed) {
    await bot.sendMessage(msg.from.id, '❌ لم يتم العثور على العرض');
  }
});

//#region  ================== Status Trades
bot.onText(/\/tradeStatus(\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const offerNumber = Number(match[1]);

  const offer = findOfferByNumber(offerNumber);

  if (!offer || !offer.trade) {
    return bot.sendMessage(chatId, '❌ الصفقة غير موجودة');
  }
  bot.sendMessage(chatId, formatTradeStatus(offer), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '🔄 تحديث الحالة', callback_data: `trade_refresh_${offer.number}` }
      ]]
    }
  });

});
bot.onText(/\/buyerCall(\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const offerNumber = Number(match[1]);

  const offer = findOfferByNumber(offerNumber);

  if (!offer || !offer.trade) {
    return bot.sendMessage(chatId, '❌ الصفقة غير موجودة');
  }
  safeSendMessage(offer.trade.buyerId, 'السلام عليكم');

});

//#region /start ==================
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {

  ////

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (userStates.botEnabled === false || userStates.botAcceptingTrades === false) {
    await safeSendMessage(chatId, '🕑 البوت متوقف حاليا');
    return;
  }
  try {
    const member = await bot.getChatMember(OFFERS_CHANNEL, userId);
    if (!['member', 'administrator', 'creator'].includes(member.status)) {
      return bot.sendMessage(chatId, `❌ يجب  الانضمام للقناة: https://t.me/WWWEXZ`, {
        parse_mode: 'HTML'
      });
    }
    if (userStates[chatId]?.blocked) {
      return safeSendMessage(chatId, '⛔ حسابك مقفول، راجع المشرف');
    }

    if (!userStates[chatId]) {
      userStates[chatId] = {
        phone: null,
        userId,
        offers: [],
        current: { step: 'askPhone' },
        verify: {
          step: null,      // waiting_photos | confirm
          photos: []
        },        // 🔐 توثيق الهوية
        tradesCount: 0,         // 📊 عدد المعاملات
        ratings: [],
        strikes: {
          count: 0,
          history: [] // timestamps
        }
      };
    }

    if (!userStates[chatId].phone) {
      return safeSendMessage(chatId, '📱 الرجاء مشاركة رقم هاتفك', {
        reply_markup: {
          keyboard: [[{ text: 'مشاركة رقمي', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true
        },
      });
    }

    const param = match?.[1];
    console.log('param', param, 'match', match);
    if (param?.startsWith('offer_')) {
      const offerId = Number(param.replace('offer_', ''));
      return startOfferFlow(chatId, offerId);
    }

    sendWelcomeMessage(chatId, msg);
  } catch (e) {
    console.log('error start :', e.message);
    safeSendMessage(chatId, '❌ تأكد أنك مشترك بالقناة والبوت مشرف');
  }
});

// Admin command to cancel a trade by offer number: /cancelTrade22
bot.onText(/\/cancelTrade(\d+)\b/, async (msg, match) => {
  const chatId = msg.chat.id;
  const num = Number(match[1]); // interpreted as tradeId now
  console.log('cancel Trade', num);

  try {
    const member = await bot.getChatMember(CHECK_CHANNEL, msg.from.id);
    if (!member || !['administrator', 'creator'].includes(member.status)) {
      return bot.sendMessage(chatId, '❌ غير مصرح');
    }
  } catch (e) {
    console.error('getChatMember failed', e && e.message);
    return bot.sendMessage(chatId, '❌ فشل التحقق');
  }
  await cancelTrade(num);
  // find offer by trade.tradeId
  // let targetOffer, owner;
  // for (const [uid, u] of Object.entries(userStates)) {
  //   if (!u?.offers) continue;
  //   const found = u.offers.find(o => o.trade && Number(o.trade.tradeId) === num);
  //   if (found) { targetOffer = found; owner = u; break; }
  // }

  // if (!targetOffer) return bot.sendMessage(chatId, `❌ لم يتم العثور على صفقة بالمعاملة رقم ${num}`);
  // if (!targetOffer.trade) return bot.sendMessage(chatId, `❌ الصفقة برقم ${num} غير موجودة حالياً`);

  // const trade = targetOffer.trade;

  // // perform cancellation similar to cancel_trade
  // delete targetOffer.trade;
  // if (targetOffer.locked) { targetOffer.locked = false; delete targetOffer.lockedBy; }
  // await saveStorage();

  // try { await safeSendMessage(trade.buyerId, `❌ تم إلغاء الصفقة رقم ${targetOffer.number}`); } catch (e) { }
  // try { await safeSendMessage(trade.sellerId, `❌ تم إلغاء الصفقة رقم ${targetOffer.number}`); } catch (e) { }

  // return bot.sendMessage(chatId, `✅ تم إلغاء الصفقة رقم ${num}`);
});

// Admin command to show trades related to a phone number: /ShowTrade(0998889607)
bot.onText(/\/ShowTrade\(?([0-9]+)\)?\b/i, async (msg, match) => {

  const chatId = msg.chat.id;
  const queryNum = match[1];

  try {
    const member = await bot.getChatMember(CHECK_CHANNEL, msg.from.id);
    if (!member || !['administrator', 'creator'].includes(member.status)) {
      return bot.sendMessage(chatId, '❌ غير مصرح');
    }
  } catch (e) {
    console.error('getChatMember failed', e && e.message);
    return bot.sendMessage(chatId, '❌ فشل التحقق');
  }

  const results = [];
  for (const [uid, u] of Object.entries(userStates)) {
    if (!u?.offers) continue;
    for (const o of u.offers) {
      if (!o.trade) continue;
      const trade = o.trade;
      const ownerPhone = u.phone || '';
      const buyerPhone = (userStates[trade.buyerId] && userStates[trade.buyerId].phone) || '';
      const sellerPhone = (userStates[trade.sellerId] && userStates[trade.sellerId].phone) || '';

      if (String(ownerPhone) === queryNum || String(buyerPhone) === queryNum || String(sellerPhone) === queryNum) {
        results.push({ offer: o, trade, ownerPhone, buyerPhone, sellerPhone });
      }
    }
  }

  if (!results.length) {
    return bot.sendMessage(chatId, `❌ لا توجد صفقات مرتبطة بالرقم ${queryNum}`);
  }

  const lines = results.map(r => {
    const o = r.offer;
    const t = r.trade;
    const amount = (o.price || 0) * (t.quantity || 0);
    return `tradeId: ${t.tradeId} | offer#: ${o.number || o.id} | qty: ${t.quantity} | amount: ${amount} | step: ${t.step} | buyer: ${r.buyerPhone || t.buyerId} | seller: ${r.sellerPhone || t.sellerId}`;
  });

  // send as a preformatted block
  await safeSendMessage(chatId, lines.join('\n'));
});

// Admin command to start the bot immediately
bot.onText(/\/StartNow\b/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const member = await bot.getChatMember(CHECK_CHANNEL, msg.from.id);
    if (!member || !['administrator', 'creator'].includes(member.status)) {
      return bot.sendMessage(chatId, '❌ غير مصرح');
    }
  } catch (e) {
    console.error('getChatMember failed', e && e.message);
    return bot.sendMessage(chatId, '❌ فشل التحقق');
  }

  userStates.botEnabled = true;
  userStates.botAcceptingTrades = true;
  await saveStorage();
  // control via /StartNow and /StopNow commands
  try { await bot.sendPhoto(OFFERS_CHANNEL, START_BOT_PHOTO, { caption: `✅ تم تفعيل البوت \n أبدأ صفقتك معنا :  @omran2002_bot` }); } catch (e) { }
  return bot.sendMessage(chatId, '✅ تم تشغيل البوت');
});

// Admin command to stop the bot immediately
bot.onText(/\/StopNow\b/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const member = await bot.getChatMember(CHECK_CHANNEL, msg.from.id);
    if (!member || !['administrator', 'creator'].includes(member.status)) {
      return bot.sendMessage(chatId, '❌ غير مصرح');
    }
    const activeTrades = await getAllActiveTrades();

    // 🔒 If ANY trade exists → do NOT stop
    if (activeTrades.length > 0) {
      let message = `❌ Cannot stop bot.\nActive trades found:\n`;

      activeTrades.forEach((t) => {
        message += `${formatTradeStatus(t.offer)}
        ----------------------\n`
      })
      bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return;
    }
  } catch (e) {
    console.error('getChatMember failed', e && e.message);
    return bot.sendMessage(chatId, '❌ فشل التحقق');
  }

  userStates.botEnabled = false;
  await saveStorage();
  // control via /StartNow and /StopNow commands
  try { await bot.sendPhoto(OFFERS_CHANNEL, STOP_BOT_PHOTO); } catch (e) { }
  return bot.sendMessage(chatId, '⛔ تم إيقاف البوت');
});

bot.onText(/\/StopAcceptTrade\b/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const member = await bot.getChatMember(CHECK_CHANNEL, msg.from.id);
    if (!member || !['administrator', 'creator'].includes(member.status)) {
      return bot.sendMessage(chatId, '❌ غير مصرح');
    }
  } catch (e) {
    console.error('getChatMember failed', e && e.message);
    return bot.sendMessage(chatId, '❌ فشل التحقق');
  }

  userStates.botAcceptingTrades = false;
  await saveStorage();
  return bot.sendMessage(chatId, '⛔ تم إيقاف قبول الصفقات');
});

bot.onText(/\/FinishAllOffers\b/, async (msg) => {

  await finishAllOffer();
})

// ================== MESSAGE FLOW ==================
bot.on('message', async (msg) => {


  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  // when bot is disabled inform the user and ignore input
  if (userStates.botEnabled === false || userStates.botAcceptingTrades === false) {
    await safeSendMessage(chatId, '🕑 البوت متوقف حاليا');
    return;
  }

  if (!userStates[chatId]) return;
  // ========== BUYER UPLOAD ==========

  if (msg.photo) {

    for (const user of Object.values(userStates)) {
      if (!user?.offers) continue;

      const offer = user.offers.find(
        o => o.trade &&
          o.trade.step === 'buyer_upload' &&
          o.trade.buyerId === chatId
      );

      if (!offer) continue;

      const trade = offer.trade;
      const fileId = msg.photo[msg.photo.length - 1].file_id;

      console.log('photo -> buyer_upload handler', { chatId, offerId: offer.id, tradeStep: trade.step, sellerId: trade.sellerId, buyerId: trade.buyerId });

      trade.buyerProofs.push(fileId);
      await saveStorage();

      console.log('pushed buyer photo', { offerId: offer.number, buyerProofsCount: trade.buyerProofs.length });

      return safeSendMessage(
        chatId,
        `📸 تم استلام الإثبات (${trade.buyerProofs.length})
        عند الانتهاء، اضغط زر *إنهاء الرفع*`
      );
    }

    // ========== SELLER UPLOAD ==========
    for (const u of Object.values(userStates)) {
      if (!u?.offers) continue;

      const offer = u.offers.find(
        o =>
          o.trade &&
          o.trade.step === 'seller_upload' &&
          o.trade.sellerId === chatId
      );

      if (!offer) continue;

      const trade = offer.trade;

      console.log('photo -> seller_upload handler', { chatId, offerId: offer.id, tradeStep: trade.step, sellerId: trade.sellerId, buyerId: trade.buyerId });

      // منع أي شيء غير الصور (احتياط)
      const photo = msg.photo[msg.photo.length - 1];
      if (!photo?.file_id) return;

      // ensure array exists (defensive)
      if (!trade.sellerProofs || !Array.isArray(trade.sellerProofs)) {
        console.warn('Initializing missing sellerProofs array', { offerId: offer.id, trade });
        trade.sellerProofs = [];
      }

      try {
        trade.sellerProofs.push(photo.file_id);
      } catch (err) {
        console.error('Failed to push seller photo', err, { offerId: offer.id, photo });
        return safeSendMessage(chatId, '❌ فشل في حفظ الصورة، حاول مرة أخرى');
      }
      await saveStorage();

      console.log('pushed seller photo', { offerId: offer.number, sellerProofsCount: trade.sellerProofs.length });

      // فقط تأكيد استلام الصورة (لا نعيد عرض تعليمات الرفع كل مرة)
      return safeSendMessage(
        trade.sellerId,
        `📸 تم استلام الإثبات (${trade.sellerProofs.length})
        عند الانتهاء، اضغط زر *إنهاء الرفع*`
      );
    }

    // ========== ADMIN UPLOAD ==========

    for (const user of Object.values(userStates)) {
      if (!user?.offers) continue;

      const offer = user.offers.find(
        o => o.trade &&
          o.trade.step === 'admin_upload'

      );
      if (!offer) continue;

      const trade = offer.trade;
      const fileId = msg.photo[msg.photo.length - 1].file_id;

      // console.log('photo -> buyer_upload handler', { chatId, offerId: offer.id, tradeStep: trade.step, sellerId: trade.sellerId, buyerId: trade.buyerId });

      trade.adminProofs.push(fileId);
      await saveStorage();

      console.log('pushed admin photo', { offerId: offer.number, adminProofsCount: trade.adminProofs.length });

      return safeSendMessage(
        chatId,
        `📸 تم استلام الإثبات (${trade.adminProofs.length})
       وتمت الصفقة عند الانتهاء، اضغط زر *إنهاء الرفع*`
      );
    }

    // ========= VERIFY ME UPLOAD ==========
    if (msg.photo.length > 0 && userStates[chatId].verify?.step === 'waiting_photos') {

      // نأخذ أعلى دقة للصورة
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      // console.log('photo verify', fileId);

      userStates[chatId].verify.photos.push(fileId);
      await saveStorage();
      return safeSendMessage(
        chatId,
        `📸 تم استلام الإثبات (${userStates[chatId].verify.photos.length})
       وتمت الصفقة عند الانتهاء، اضغط زر *إنهاء الرفع*`
      );
    }

  }
  else {

    // ========== SELLER PAYMENT INFO ==========
    if (msg.text && !msg.photo && !msg.contact && msg.text.trim().length > 8) {
      const text = msg.text.trim();

      for (const u of Object.values(userStates)) {
        if (!u?.offers) continue;

        const offer = u.offers.find(
          o =>
            o.trade &&
            o.trade.step === 'seller_payment_info' &&
            o.trade.sellerId === chatId
        );

        if (!offer) continue;

        const trade = offer.trade;

        // حفظ معلومات الدفع وانتظار تأكيد البائع قبل الإرسال للمشرف
        trade.paymentInfo = text;
        trade.step = 'seller_confirm_payment_info';

        await saveStorage();

        // إشعار البائع ليتأكد ويضغط الزر
        await safeSendMessage(
          chatId,
          '✅ تم حفظ معلومات الدفع، الرجاء تأكيد الإرسال للمشرف بالضغط على الزر أدناه',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ تأكيد ', callback_data: JSON.stringify({ type: 'confirm_seller_payment_info', offerId: offer.id }) },
                { text: '❌ إلغاء', callback_data: JSON.stringify({ type: 'cancel_offer', offerId: offer.id }) }
              ]]
            }
          }
        );

        return;
      }

      // ========== BUYER PAYMENT INFO ==========
      for (const u of Object.values(userStates)) {
        if (!u?.offers) continue;

        const offer = u.offers.find(
          o =>
            o.trade &&
            o.trade.step === 'buyer_payment_info' &&
            o.trade.buyerId === chatId
        );

        if (!offer) continue;

        const trade = offer.trade;

        // حفظ معلومات الدفع من المشتري وانتظار تأكيد المشتري قبل الإرسال للمشرف
        trade.buyerPaymentInfo = text;
        trade.step = 'buyer_confirm_payment_info';

        await saveStorage();

        // إشعار المشتري ليتأكد ويضغط الزر
        await safeSendMessage(
          chatId,
          '✅ تم حفظ معلومات الدفع، الرجاء تأكيد الإرسال للمشرف بالضغط على الزر أدناه',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ تأكيد ', callback_data: JSON.stringify({ type: callbackTypes.confirm_buyer_payment_info, offerId: offer.id }) },
                { text: '❌ إلغاء', callback_data: JSON.stringify({ type: callbackTypes.cancel_offer, offerId: offer.id }) }
              ]]
            }
          }
        );

        return;
      }
    }


    const state = userStates[chatId]?.current;
    if (!state) return

    if (state.step === 'askPhone' && msg.contact) {
      console.log('hi');

      userStates[chatId].phone = msg.contact.phone_number;
      userStates[chatId].first_name = msg.contact.first_name;
      userStates[chatId].last_name = msg.contact.last_name;

      userStates[chatId].current = {};
      await saveStorage();
      return sendWelcomeMessage(chatId, msg);
    }

    if (state.step === 'askPrice') {
      if (!isValidNumber(msg.text)) {
        return safeSendMessage(chatId, '❌ الرجاء إدخال رقم صحيح للسعر');
      }

      state.price = msg.text;
      state.step = 'askMinQuantity';
      await saveStorage();
      return safeSendMessage(chatId, `تم حفظ السعر : ${state.price}
    أدخل الحد الأدنى للكمية`);
    }

    if (state.step === 'askMinQuantity') {
      if (!isValidNumber(msg.text)) {
        return safeSendMessage(chatId, '❌ الرجاء إدخال رقم صحيح للحد الأدنى');
      }

      state.minQuantity = msg.text;
      state.step = 'askMaxQuantity';
      await saveStorage();
      return safeSendMessage(chatId, ` تم حفظ الحد الأدنى : ${state.minQuantity}
    أدخل الحد الأعلى للكمية`);
    }

    if (state.step === 'askMaxQuantity') {
      if (!isValidNumber(msg.text)) {
        return safeSendMessage(chatId, '❌ الرجاء إدخال رقم صحيح للحد الأعلى');
      }

      state.maxQuantity = msg.text;
      state.step = 'askPayment';
      await saveStorage();

      return safeSendMessage(chatId, `تم حفظ الحد الأعلى : ${state.maxQuantity}
    اختر طريقة الدفع`, {
        reply_markup: {
          inline_keyboard: Object.entries(transform_way).map(([k, v]) => [
            { text: v, callback_data: JSON.stringify({ type: callbackTypes.transform_way, data: k }) }
          ])
        }
      });
    }

    if (state.step === 'editPrice') {
      if (!isValidNumber(msg.text)) {
        return safeSendMessage(chatId, '❌ الرجاء إدخال رقم صحيح للسعر');
      }

      userStates[chatId].current.editDraft = userStates[chatId].current.editDraft || {};
      userStates[chatId].current.editDraft.price = msg.text;
      userStates[chatId].current.step = 'editing_offer';
      await saveStorage();

      return safeSendMessage(chatId, `✅ تم تحديث السعر إلى ${msg.text}`, {
        reply_markup: {
          inline_keyboard: [[{ text: '✅ إرسال التعديل للمشرف', callback_data: JSON.stringify({ type: callbackTypes.submit_edit, offerId: userStates[chatId].current.editingOfferId }) }], [{ text: '⬅️ رجوع', callback_data: JSON.stringify({ type: 'manage_offers' }) }]]
        }
      });
    }

    if (state.step === 'editQuantity') {
      const parts = msg.text.trim().split(/\s+/);
      if (parts.length < 2 || !isValidNumber(parts[0]) || !isValidNumber(parts[1])) {
        return safeSendMessage(chatId, '❌ الرجاء إرسال الحد الأدنى والحد الأقصى مفصولين بمسافة (مثال: 1 10)');
      }

      userStates[chatId].current.editDraft = userStates[chatId].current.editDraft || {};
      userStates[chatId].current.editDraft.minQuantity = parts[0];
      userStates[chatId].current.editDraft.maxQuantity = parts[1];
      userStates[chatId].current.step = 'editing_offer';
      await saveStorage();

      return safeSendMessage(chatId, `✅ تم تحديث الكمية إلى ${parts[0]} - ${parts[1]}`, {
        reply_markup: {
          inline_keyboard: [[{ text: '✅ إرسال التعديل للمشرف', callback_data: JSON.stringify({ type: callbackTypes.submit_edit, offerId: userStates[chatId].current.editingOfferId }) }], [{ text: '⬅️ رجوع', callback_data: JSON.stringify({ type: 'manage_offers' }) }]]
        }
      });
    }

    if (state.step === 'ask_quantity') {
      const qty = Number(msg.text);
      if (isNaN(qty)) {
        return safeSendMessage(chatId, '❌ الرجاء إدخال رقم');
      }

      const offerOwner = userStates[state.offerOwnerId];
      const offer = offerOwner.offers.find(o => o.id === state.offerId);

      if (qty < offer.minQuantity || qty > offer.maxQuantity) {
        return safeSendMessage(chatId, '❌ الكمية خارج الحدود المسموحة');
      }

      state.quantity = qty;
      state.step = 'confirm_quantity';

      return safeSendMessage(
        chatId,
        `⚠️ تأكيد نهائي\n
  الكمية: ${qty}
  ❗ لا يمكن التراجع بعد التأكيد`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ تأكيد الكمية', callback_data: JSON.stringify({ type: 'confirm_quantity' }) },
              { text: '❌ إلغاء', callback_data: JSON.stringify({ type: 'cancel_quantity' }) }
            ]]
          }
        }
      );
    }


  }



});

// bot.on('message', async msg => {

//   const chatId = msg.chat.id;

//   if (msg.text && msg.text.startsWith('/')) return;

//   // if bot disabled, inform user and ignore any message


//   if (userStates.botEnabled === false || userStates.botAcceptingTrades === false) {
//     await safeSendMessage(chatId, '🕑 البوت متوقف حاليا');
//     return;
//   }

//   if (!userStates[chatId]) return;
//   const user = userStates[chatId];

// });


//#region CALLBACK ==================
bot.on('callback_query', async (query) => {

  if (query.data.startsWith('trade_refresh_')) {

    const offerNumber = Number(query.data.split('_')[2]);
    const offer = findOfferByNumber(offerNumber);

    if (!offer) return;

    await safeEditMessageText(formatTradeStatus(offer), {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔄 تحديث الحالة', callback_data: `trade_refresh_${offer.number}` }
        ]]
      }
    });
  }

  const chatId = query.message.chat.id;
  if (userStates.botEnabled === false || userStates.botAcceptingTrades === false) {
    await safeSendMessage(chatId, '🕑 البوت متوقف حاليا');
    return;
  }
  // =========== rating
  if (query.data.startsWith('rate:')) {
    const [, rate, targetUser, offerId] = query.data.split(':');
    // const { rate, targetUser, offerId } = payload;
    const target = userStates[targetUser];
    const rater = userStates[query.from.id];
    if (!target || !rater) return;

    target.ratings = target.ratings || [];
    target.ratings.push({
      from: query.from.id,
      rate: Number(rate),
      date: Date.now()
    });

    // وسم العرض أنه تم تقييمه
    rater.offers.forEach(o => {
      if (o.id === offerId) o.rated = true;
    });

    await saveStorage();

    await bot.editMessageText(
      '✅ شكراً لتقييمك',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );

    return sendWelcomeMessage(query.message.chat.id, query.message);
  }

  let payload;
  try { payload = JSON.parse(query.data); } catch { return; }

  // const chatId = query.message.chat.id;

  // ===== CONFIRM SEND =====
  if (payload.type === callbackTypes.confirm_send) {
    return sendOfferForReview(chatId, query.message.message_id);
  }

  // Toggle bot enabled/disabled (only channel admins/creators allowed)


  if (payload.type === callbackTypes.edit_price) {
    const { offerId } = payload;
    const user = userStates[query.from.id];
    if (!user) return bot.answerCallbackQuery(query.id, { text: '❌ خطأ' });

    user.current = user.current || {};
    user.current.step = 'editPrice';
    user.current.editingOfferId = offerId;
    await saveStorage();

    await safeSendMessage(query.from.id, 'أرسل السعر الجديد (عدد فقط)');
    return bot.answerCallbackQuery(query.id);
  }

  if (payload.type === callbackTypes.edit_quantity) {
    const { offerId } = payload;
    const user = userStates[query.from.id];
    if (!user) return bot.answerCallbackQuery(query.id, { text: '❌ خطأ' });

    user.current = user.current || {};
    user.current.step = 'editQuantity';
    user.current.editingOfferId = offerId;
    await saveStorage();

    await safeSendMessage(query.from.id, 'أرسل الحد الأدنى والحد الأقصى مفصولين بمسافة (مثال: 1 10)');
    return bot.answerCallbackQuery(query.id);
  }

  if (payload.type === callbackTypes.edit_transform_way) {
    // send transform_way options (reuse existing keys)
    const keyboard = Object.entries(transform_way).map(([k, v]) => [{ text: v, callback_data: JSON.stringify({ type: callbackTypes.transform_way, data: k }) }]);
    await safeSendMessage(query.from.id, 'اختر طريقة الدفع الجديدة:', { reply_markup: { inline_keyboard: keyboard } });
    return bot.answerCallbackQuery(query.id);
  }

  // submit edited offer to admin for approval
  if (payload.type === callbackTypes.submit_edit) {
    const { offerId } = payload;
    const user = userStates[query.from.id];
    if (!user || !user.current?.editDraft) return bot.answerCallbackQuery(query.id, { text: '❌ لا يوجد تعديل' });

    // mark the old offer as rejected/cancelled and finish it (update channel messages)
    const draft = user.current.editDraft;
    const oldIndex = user.offers.findIndex(o => o.id === offerId);
    if (oldIndex >= 0) {
      const oldOffer = user.offers[oldIndex];
      oldOffer.status = 'rejected';
      await saveStorage();
      try { await finishOffer(user, oldOffer); } catch (e) { console.error('finishOffer failed', e.message); }
    }

    // Prepare a clean current state from the draft so sendOfferForReview creates a brand-new offer
    const newCurrent = Object.assign({}, draft);
    // remove identifying / channel fields that would interfere with new offer creation
    ['id', 'status', 'userId', 'checkMessageId', 'publicMessageId', 'matchedWith', 'rated', 'trade', 'number'].forEach(k => delete newCurrent[k]);

    user.current = newCurrent;
    await saveStorage();

    // reuse existing flow to create a fresh offer and send it for review
    await sendOfferForReview(query.message.chat.id, query.message.message_id);
    return bot.answerCallbackQuery(query.id, { text: '✅ تم إنشاء عرض جديد وتم إلغاء القديم' });
  }

  // ===== Edit offer (start edit flow) =====
  if (payload.type === callbackTypes.edit_offer) {
    const { offerId } = payload;
    const user = userStates[query.from.id];
    if (!user) return bot.answerCallbackQuery(query.id, { text: '❌ خطأ' });

    const offer = user.offers.find(o => o.id === offerId);
    if (!offer) return bot.answerCallbackQuery(query.id, { text: '❌ العرض غير موجود' });

    // prepare edit draft
    user.current = user.current || {};
    user.current.step = 'editing_offer';
    user.current.editingOfferId = offerId;
    user.current.editDraft = Object.assign({}, offer);
    await saveStorage();

    // send edit menu
    await safeSendMessage(query.from.id, `🔧 تعديل العرض رقم ${offer.number}\nاختر الحقل الذي تريد تعديله:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ تعديل السعر', callback_data: JSON.stringify({ type: callbackTypes.edit_price, offerId }) }],
          [{ text: '🔢 تعديل الكمية', callback_data: JSON.stringify({ type: callbackTypes.edit_quantity, offerId }) }],
          [{ text: '💳 تعديل طرق الدفع', callback_data: JSON.stringify({ type: callbackTypes.edit_transform_way, offerId }) }],
          [{
            text: '⬅️ رجوع',
            callback_data: JSON.stringify({ type: 'back' })
          }]
        ]
      }
    });

    return bot.answerCallbackQuery(query.id);
  }

  // ===== CANCEL OFFER =====
  if (payload.type === callbackTypes.cancel_offer) {
    const user = userStates[query.from.id];
    if (!user) return bot.answerCallbackQuery(query.id, { text: '❌ خطأ' });

    user.current = {};
    await saveStorage();

    await bot.editMessageText(
      '❌ تم إلغاء إنشاء العرض',
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );

    return bot.answerCallbackQuery(query.id);
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
  if (payload.type === callbackTypes.verify_me) {
    const user = userStates[query.from.id];
    if (!user) return;

    user.verify = {
      step: 'waiting_photos',
      photos: []
    };

    await saveStorage();

    return safeSendMessage(
      query.from.id,
      '📸 أرسل صور الهوية \n\nعند الانتهاء اضغط زر *تأكيد رفع الثبوتيات*',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ تأكيد ', callback_data: JSON.stringify({ type: callbackTypes.verify_confirm }) },
            { text: '❌ إلغاء', callback_data: JSON.stringify({ type: 'verify_cancel' }) }
          ]]
        }
      }
    );
  }
  if (payload.type === 'verify_cancel') {
    const user = userStates[query.from.id];
    if (!user) return;
    user.verify = {
      step: null,
      photos: []
    };
    await saveStorage();
    await safeSendMessage(
      query.from.id,
      '❌ تم إلغاء عملية التوثيق'
    );
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }
    return;
  }
  if (payload.type === callbackTypes.verify_confirm) {
    const user = userStates[query.from.id];
    if (!user || !user.verify.photos.length) {
      return bot.answerCallbackQuery(query.id, {
        text: '❗ لم تقم برفع أي صورة'
      });
    }

    // إرسال طلب التوثيق للمشرف
    await safeSendMessage(
      CHECK_CHANNEL,
      `🔐 طلب توثيق حساب\n👤 ${user.first_name}\n📞 ${user.phone}`
    );

    for (const photoId of user.verify.photos) {
      await bot.sendPhoto(CHECK_CHANNEL, photoId);
      await delay(300)
    }

    await safeSendMessage(CHECK_CHANNEL, 'اختر الإجراء:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ قبول التوثيق', callback_data: JSON.stringify({ type: callbackTypes.verify_approve, userId: query.from.id }) },
          { text: '❌ رفض', callback_data: JSON.stringify({ type: callbackTypes.verify_reject, userId: query.from.id }) }
        ]]
      }
    });

    user.verify.step = 'confirm';
    await saveStorage();

    // حدّث رسالة المستخدم التي تحتوي على أزرار التأكيد بدلاً من إرسال رسالة جديدة
    try {
      await bot.editMessageText(
        '⏳ تم إرسال الثبوتيات للمراجعة',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id
        }
      );
    } catch (e) {
      // في حال فشل التعديل، نرسل إشعارًا بديلًا
      await safeSendMessage(query.from.id, '⏳ تم إرسال الثبوتيات للمراجعة');
    }

    // return bot.answerCallbackQuery(query.id);
  }

  if (payload.type === callbackTypes.verify_approve) {
    const userId = payload.userId;
    const user = userStates[userId];
    if (!user) return;

    user.verified = true;            // ✅ الحساب موثّق
    user.verify.step = null;
    await saveStorage();

    // تعديل رسالة المشرف
    await bot.editMessageText(
      '✅ تم قبول توثيق الحساب',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );

    // إشعار المستخدم
    await safeSendMessage(
      userId,
      '✅ تم توثيق حسابك بنجاح\nيمكنك الآن الاستفادة من أفضلية التداول'
    );

    return bot.answerCallbackQuery(query.id, { text: 'تم قبول التوثيق' });
  }
  if (payload.type === callbackTypes.verify_reject) {
    const userId = payload.userId;
    const user = userStates[userId];
    if (!user) return;

    user.verified = false;
    user.verify = {
      step: null,
      photos: []
    };

    await saveStorage();

    // تعديل رسالة المشرف
    await bot.editMessageText(
      '❌ تم رفض توثيق الحساب',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );

    // إشعار المستخدم
    await safeSendMessage(
      userId,
      '❌ تم رفض توثيق الحساب\nيرجى إعادة رفع صور أوضح'
    );

    return bot.answerCallbackQuery(query.id, { text: 'تم الرفض' });
  }
  // ===== SELLER CONFIRM PAYMENT INFO (seller presses) =====
  if (payload.type === callbackTypes.confirm_seller_payment_info) {
    const { offerId } = payload;

    // find offer and seller
    let offer, sellerUser;
    for (const u of Object.values(userStates)) {
      const found = u?.offers?.find(o => o.id === offerId);
      if (found) { offer = found; sellerUser = u; break; }
    }

    if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });

    const trade = offer.trade;

    // only seller can confirm
    if (query.from.id !== trade.sellerId) {
      return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح' });
    }

    // forward to admin for approval
    trade.step = 'wait_admin_confirm_payment_info';
    await saveStorage();

    await safeSendMessage(
      APPROVE_REJECT_CHANNEL,
      `
      📦 الكمية: ${trade.quantity}
      المبلغ  الذي سيصيلك: ${getPrice(offer.price, trade.quantity)}
      🏦 معلومات دفع مرسلة للمراجعة
      <code>${trade.paymentInfo}</code>
      `,
      { parse_mode: 'HTML' }
    );
    await safeSendMessage(
      APPROVE_REJECT_CHANNEL,
      `
     اختر الإجراء:
      `,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ الموافقة', callback_data: JSON.stringify({ type: 'admin_confirm_seller_payment_info', offerId }) },
            { text: '❌ رفض', callback_data: JSON.stringify({ type: 'admin_reject_seller_payment_info', offerId }) }
          ]]
        }
      }
    );

    // حذف رسالة تأكيد الإرسال من البائع
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }

    return bot.answerCallbackQuery(query.id, { text: 'تم الإرسال للمشرف' });
  }

  if (payload.type === 'admin_reject_seller_payment_info') {
  const { offerId } = payload;

  let offer;

  for (const u of Object.values(userStates)) {
    const found = u?.offers?.find(o => o.id === offerId);
    if (found) {
      offer = found;
      break;
    }
  }

  if (!offer || !offer.trade) {
    return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });
  }

  const { sellerId } = offer.trade;

  // إشعار البائع فقط — بدون تغيير أي حالة
  await safeSendMessage(
    sellerId,
    `❌ معلومات الاستلام غير صحيحة
الرجاء تعديل معلومات الاستلام وإعادة إرسالها بشكل صحيح ✅`
  );

  // تحديث رسالة المشرف (اختياري)
  try {
    await bot.editMessageText(
      `❌ تم طلب تعديل معلومات الاستلام من البائع
رقم العرض: ${offer.number}`,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );
  } catch (e) {}

  return bot.answerCallbackQuery(query.id, { text: 'تم الإشعار' });
}

  // ===== BUYER CONFIRM PAYMENT INFO (buyer presses) =====
  if (payload.type === 'seller_confirm_buyer') {
    const { offerId } = payload;

    // find offer and buyer
    let offer, buyerUser;
    for (const u of Object.values(userStates)) {
      const found = u?.offers?.find(o => o.id === offerId);
      if (found) { offer = found; buyerUser = u; break; }
    }

    if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });

    const trade = offer.trade;

    // only buyer can confirm
    // if (query.from.id !== trade.buyerId) {
    //   return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح' });
    // }

    // forward to admin for approval
    trade.step = 'buyer_payment_info';
    await saveStorage();

    // await safeSendMessage(
    //   APPROVE_REJECT_CHANNEL,
    //   `
    //   📦 الكمية: ${trade.quantity}
    //   المبلغ المطلوب: ${trade.quantity * offer.price}
    //   🏦 معلومات دفع المشتري مرسلة للمراجعة
    //   <code>${trade.buyerPaymentInfo}</code>
    //   `,
    //   {
    //     parse_mode: 'HTML',
    //     reply_markup: {
    //       inline_keyboard: [[
    //         { text: '✅ الموافقة', callback_data: JSON.stringify({ type: 'admin_confirm_buyer_payment_info', offerId }) },
    //         { text: '❌ رفض', callback_data: JSON.stringify({ type: 'admin_reject_buyer', offerId }) }
    //       ]]
    //     }
    //   }
    // );
    await safeSendMessage(
      trade.buyerId,
      `🏦 الرجاء إدخال معلومات الاستلام الخاصة بك
يرجى ارسال عنوان المحفظة على السلسلة BEP20 فقط
📦 الكمية: ${trade.quantity}
المبلغ : ${getPrice(offer.price, trade.quantity)}
`,
    );

    // إرسال صور إثباتات المشتري للمشرف (إن وُجدت)
    // if (trade.buyerProofs && trade.buyerProofs.length) {
    //   for (const p of trade.buyerProofs) {
    //     await bot.sendPhoto(APPROVE_REJECT_CHANNEL, p);
    //     await delay(300);
    //   }
    // }

    // حذف رسالة تأكيد الإرسال من المشتري
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }

    // return bot.answerCallbackQuery(query.id, { text: 'تم الإرسال للمشرف' });

  }
  if (payload.type === callbackTypes.confirm_buyer_payment_info) {
    const { offerId } = payload;

    let offer, buyerUser;
    for (const u of Object.values(userStates)) {
      const found = u?.offers?.find(o => o.id === offerId);
      if (found) { offer = found; buyerUser = u; break; }
    }

    // console.log('hello admin approve payment info 1',offer?.trade.step);
    if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });

    const trade = offer.trade;
    trade.step = 'admin_upload';
    await safeSendMessage(
      APPROVE_REJECT_CHANNEL,
      `📋 معلومات الدفع:\nرقم المعاملة: ${trade.tradeId}\n📦 الكمية: ${trade.quantity}\n💰 المبلغ المطلوب: ${getPrice(offer.price, trade.quantity)}\n\n🏦 معلومات الدفع:\n <code>${trade.buyerPaymentInfo}</code>\n\n📥 الرجاء إرسال إثباتات التحويل (صور فقط)`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ إنهاء رفع الإثباتات', callback_data: JSON.stringify({ type: 'finalize_trade', offerId: offer.id }) }
          ]]
        }
      }
    );
    await saveStorage()
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }


  }
  // ===== ADMIN APPROVES PAYMENT INFO =====
  if (payload.type === 'admin_confirm_seller_payment_info') {
    const { offerId } = payload;

    let offer, sellerUser;
    for (const u of Object.values(userStates)) {
      const found = u?.offers?.find(o => o.id === offerId);
      if (found) { offer = found; sellerUser = u; break; }
    }

    // console.log('hello admin approve payment info 1',offer?.trade.step);
    if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });

    const trade = offer.trade;
    userStates[chatId] = {
      ...userStates[chatId],
    };

    trade.step = 'buyer_upload';
    await saveStorage();

    // حذف رسالة المشرف بعد الموافقة
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }

    // notify buyer
    await safeSendMessage(
      trade.buyerId,
      `📋 معلومات الدفع:\nرقم المعاملة: ${trade.tradeId}\n📦 الكمية: ${trade.quantity}\n💰 المبلغ المطلوب: ${getPrice(offer.price, trade.quantity)}\n\n🏦 معلومات الدفع:\n <code>${trade.paymentInfo}</code>\n\n📥 الرجاء إرسال إثباتات التحويل (صور فقط)`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ إنهاء رفع الإثباتات', callback_data: JSON.stringify({ type: 'buyer_done_upload', offerId: offer.id }) }
          ]]
        }
      }
    );

    return bot.answerCallbackQuery(query.id, { text: 'تم الموافقة' });
  }

  // ===== ADMIN APPROVES BUYER PAYMENT INFO =====
//   if (payload.type === 'admin_confirm_buyer_payment_info') {
//     const { offerId } = payload;

//     let offer, ownerUser;
//     for (const u of Object.values(userStates)) {
//       const found = u?.offers?.find(o => o.id === offerId);
//       if (found) { offer = found; ownerUser = u; break; }
//     }

//     if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });

//     const trade = offer.trade;

//     // move to seller upload so seller can upload proofs after buyer payment info approved
//     trade.step = 'seller_upload';
//     await saveStorage();

//     // حذف رسالة المشرف بعد الموافقة
//     try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }

//     // notify seller with buyer payment info
//     await safeSendMessage(
//       trade.sellerId,
//       `📋 معلومات دفع المشتري المعتمدة:
// رقم المعاملة: ${trade.tradeId}
// 📦 الكمية: ${trade.quantity}
// 💰 المبلغ المطلوب: ${trade.quantity * offer.price}

// 🏦 معلومات دفع المشتري:
//  <code>${trade.buyerPaymentInfo}</code>

// 📥 الرجاء إرسال إثباتات التحويل (صور فقط)`,
//       {
//         parse_mode: 'HTML',
//         reply_markup: {
//           inline_keyboard: [[
//             { text: '✅ إنهاء رفع الإثباتات', callback_data: JSON.stringify({ type: 'seller_done_upload', offerId: offer.id }) }
//           ]]
//         }
//       }
//     );

//     return bot.answerCallbackQuery(query.id, { text: 'تم الموافقة' });
//   }

  // ===== ADMIN REJECTS BUYER PAYMENT INFO =====
  if (payload.type === 'admin_reject_buyer') {
    const { offerId } = payload;

    let offer;
    for (const u of Object.values(userStates)) {
      offer = u?.offers?.find(o => o.id === offerId);
      if (offer) break;
    }

    if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });

    const trade = offer.trade;
    trade.step = 'buyer_payment_info';
    await saveStorage();

    try { await bot.editMessageText('❌ تم رفض معلومات المشتري', { chat_id: query.message.chat.id, message_id: query.message.message_id }); } catch (e) { }

    // notify buyer
    await safeSendMessage(trade.buyerId, '❌ تم رفض معلومات الدفع الخاصة بك من قبل المشرف. الرجاء إرسال معلومات صحيحة');

    return bot.answerCallbackQuery(query.id, { text: 'تم الرفض' });
  }
  // ========== ADMIN CONFIRM SELLER ==========
  if (payload.type === 'admin_confirm_seller') {
    const { offerId } = payload;

    let offer;
    for (const u of Object.values(userStates)) {
      offer = u?.offers?.find(o => o.id === offerId);
      if (offer) break;
    }

    if (!offer?.trade) {
      return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });
    }

    const trade = offer.trade;
    // بعد قبول المشرف لإثباتات البائع
    trade.step = 'seller_payment_info';
    await saveStorage();

    // حذف رسالة المشرف بعد قبول إثباتات البائع
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }

    // طلب معلومات الدفع من البائع
    await safeSendMessage(
      trade.sellerId,
      `🏦 الرجاء إدخال معلومات الاستلام الخاصة بك
     
📦 الكمية: ${trade.quantity}
المبلغ : ${getPrice(offer.price, trade.quantity)}
`,
    );


    await bot.editMessageText(
      '✅ تم قبول إثباتات البائع📥 بانتظار إثباتات المشتري',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );



    return bot.answerCallbackQuery(query.id, { text: 'تم التأكيد' });
  }




  if (payload.type === callbackTypes.sellOrBuy) {
    const user = userStates[chatId];
    if (!user) return bot.answerCallbackQuery(query.id, { text: '❌ خطأ' });

    user.current = {
      operation: payload.data === 'sell' ? 'بيع' : 'شراء',
      step: 'askPrice'
    };

    await saveStorage();
    return safeSendMessage(chatId, 'أدخل السعر');
  }
  if (payload.type === 'seller_done_upload') {
    const { offerId } = payload;

    // البحث عن العرض والبائع
    let seller, offer;
    for (const [uid, user] of Object.entries(userStates)) {
      if (!user?.offers) continue;
      const found = user.offers.find(o => o.id === offerId);
      if (found) {
        seller = user;
        offer = found;
        break;
      }
    }

    if (!seller || !offer || !offer.trade) {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ الصفقة غير موجودة'
      });
    }

    const trade = offer.trade;

    // تأكيد أن البائع هو من ضغط الزر
    if (query.from.id !== trade.sellerId) {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ غير مصرح لك'
      });
    }

    // determine which proof array contains the uploaded files for this user
    let uploadedProofs = [];
    if (trade.sellerProofs && trade.sellerProofs.length && query.from.id === trade.sellerId) {
      uploadedProofs = trade.sellerProofs;
    } else if (trade.buyerProofs && trade.buyerProofs.length && query.from.id === trade.buyerId) {
      // fallback: files accidentally stored in buyerProofs
      uploadedProofs = trade.buyerProofs;
    }

    if (!uploadedProofs.length) {
      return bot.answerCallbackQuery(query.id, {
        text: '❗ لم يتم رفع أي إثبات'
      });
    }

    // حذف رسالة "إنهاء رفع الإثباتات" التي ضغط عليها البائع
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }

    // تحديث المرحلة
    trade.step = 'wait_admin_seller';
    await saveStorage();

    // إرسال للمشرف (قناة مراجعة الصفقات)
    await safeSendMessage(
      APPROVE_REJECT_CHANNEL,
      `🧾 إثباتات البائع
  👤 البائع: ${userStates[trade.sellerId]?.phone}
  👤 المشتري: ${userStates[trade.buyerId]?.phone}
  📦 الكمية: ${trade.quantity}
   المبلغ المطلوب: ${getPrice(offer.price, trade.quantity)}
  `
    );

    for (const p of uploadedProofs) {
      await bot.sendPhoto(APPROVE_REJECT_CHANNEL, p);
      await delay(300);
    }

    await safeSendMessage(
      APPROVE_REJECT_CHANNEL,
      'اختر الإجراء:',
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '✔️ الإثباتات صحيحة',
              callback_data: JSON.stringify({ type: 'admin_confirm_seller', offerId })
            },
            {
              text: '❌ رفض الإثباتات',
              callback_data: JSON.stringify({ type: 'admin_reject_seller', offerId })
            }
          ]]
        }
      }
    );

    // إشعار البائع
    await safeSendMessage(
      trade.sellerId,
      '⏳ تم إرسال الإثباتات للمراجعة، بانتظار المراجعة من قبل المشرف'
    );

    return bot.answerCallbackQuery(query.id, {
      text: 'تم الإرسال'
    });
  }

  if (payload.type === 'confirm_quantity') {
    const chatId = query.from.id;
    const buyer = userStates[chatId];
    if (!buyer?.current) return;

    const { offerId, offerOwnerId, quantity } = buyer.current;
    if (!offerId || !offerOwnerId || !quantity) {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ بيانات غير مكتملة'
      });
    }

    const seller = userStates[offerOwnerId];
    if (!seller) return;

    const offer = seller.offers.find(o => o.id === offerId);
    if (!offer || offer.status === 'done ' || offer.status === 'rejected') {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ العرض غير متاح'
      });
    }
    if (offer.locked) {
      return bot.answerCallbackQuery(query.id, { text: '❌ العرض محجوز حالياً' });
    }

    // إنشاء صفقة جديدة (بدون كسر بنية العرض)
    userStates.tradeId = (userStates.tradeId || 0) + 1;

    // حدد البائع والمشتري اعتمادًا على نوع العملية: إذا كان العرض 'بيع' فصاحب العرض هو البائع، وإلا صاحب العرض هو المشتري
    const isOfferSell = offer.operation === 'بيع';
    const sellerId = isOfferSell ? offerOwnerId : chatId;
    const buyerId = isOfferSell ? chatId : offerOwnerId;

    offer.trade = {
      tradeId: userStates.tradeId,
      buyerId: buyerId,
      sellerId: sellerId,
      quantity: quantity,

      step: 'owner_pending_accept',   // صاحب العرض يجب أن يؤكد أولاً
      sellerProofs: [],
      buyerProofs: [],
      adminProofs: [],

      createdAt: Date.now()
    };

    console.log('trade ', offer.trade);

    // تنظيف حالة المستخدم
    buyer.current = {};

    await saveStorage();

    // إشعار المشتري
    await safeSendMessage(
      chatId,
      `✅ تم تأكيد الكمية بنجاح
📦 الكمية: ${quantity}

⏳ طلبك قيد المراجعة`
    );

    // إشعار صاحب العرض مع أزرار قبول/رفض (صاحب العرض يؤكد دائماً)
    await safeSendMessage(
      APPROVE_REJECT_CHANNEL,
      `📣 صفقة جديدة قيد الانتظار
    رقم العرض : ${offer.number}
    صاحب العرض: +${seller.phone}
    الاسم الصريح : ${seller.first_name}`
    );
    await safeSendMessage(
      offerOwnerId,
      `📣📣🔥 لديك صفقة جديدة\nرقم العرض : ${offer.number}\n📦 الكمية: ${quantity}\n\nهل تقبل هذه الصفقة؟`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ قبول الصفقة', callback_data: JSON.stringify({ type: callbackTypes.seller_accept_trade, offerId: offer.id }) },
            { text: '❌ رفض الصفقة', callback_data: JSON.stringify({ type: callbackTypes.seller_reject_trade, offerId: offer.id }) }
          ]]
        }
      }
    );

    // حذف رسالة تأكيد الكمية التي ضغط عليها المشتري
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }
    return bot.answerCallbackQuery(query.id, {
      text: 'تم تأكيد الكمية'
    });
  }

  // ===== Seller accepts the trade =====
  if (payload.type === callbackTypes.seller_accept_trade) {
    const { offerId } = payload;

    let offer, sellerUser;
    for (const u of Object.values(userStates)) {
      const found = u?.offers?.find(o => o.id === offerId);
      if (found) { offer = found; sellerUser = u; break; }
    }

    if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });

    const trade = offer.trade;
    console.log('sellllr', trade.sellerId);
    const sellerUserId = offer.userId
    // only offer owner can accept (تأكيد الصفقة دائماً من صاحب العرض)
    if (query.from.id !== sellerUserId) return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح' });

    // move to upload step
    trade.step = 'seller_upload';
    // حجز العرض لمنع أي بديل من البدء
    offer.locked = true;
    offer.lockedBy = query.from.id;

    await saveStorage();

    // notify seller to upload proofs
    await safeSendMessage(trade.sellerId, `
      📤 الرجاء إرسال إثباتات التحويل (صور فقط)
      📦 المبلغ المطلوب: ${trade.quantity} USDT
      💰 ستستلم : ${getPrice(offer.price, trade.quantity)}

      عنوان المحظة :   
      <code>0x4411666a53d7ec17ac4610797a0529f3bb63e8e6</code>
      عبر السلسلة BEP20 
       بعد الإرسال اضغط 'إنهاء رفع الإثباتات'`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '📤 إنهاء رفع الإثباتات', callback_data: JSON.stringify({ type: 'seller_done_upload', offerId: offer.id }) }]]
      }
    });

    // notify buyer that trade was accepted and proofs are awaited
    await safeSendMessage(APPROVE_REJECT_CHANNEL, `
      ⏳ تم قبول الصفقة، بانتظار إثباتات التحويل
      رقم العرض: ${offer.number}
      البائع: +${userStates[trade.sellerId]?.phone}
      المشتري: +${userStates[trade.buyerId]?.phone}
      اسم البائع  : ${userStates[trade.sellerId]?.first_name}
      اسم المشتري  : ${userStates[trade.buyerId]?.first_name}
      📦 الكمية: ${trade.quantity}
      المبلغ المطلوب: ${getPrice(offer.price, trade.quantity)}
      `);
    await safeSendMessage(trade.buyerId, '⏳ تم قبول الصفقة، بانتظار إثباتات التحويل');

    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }
    // return bot.answerCallbackQuery(query.id, { text: 'تم قبول الصفقة' });
  }

  // ===== Seller rejects the trade =====
  if (payload.type === callbackTypes.seller_reject_trade) {
    const { offerId } = payload;

    let offer, sellerUser;
    for (const u of Object.values(userStates)) {
      const found = u?.offers?.find(o => o.id === offerId);
      if (found) { offer = found; sellerUser = u; break; }
    }

    if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });

    const trade = offer.trade;

    // رفض الصفقة يجب أن يتم من قبل صاحب العرض
    if (query.from.id !== sellerUser.userId) return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح' });

    // remove trade and close offer in channels
    delete offer.trade;

    offer.status = 'rejected';
    await saveStorage();

    // mark as closed in channels
    await finishOffer(sellerUser, offer);

    // notify both parties
    await safeSendMessage(trade.buyerId, `❌ تم رفض الصفقة من البائع\nالعرض رقم: ${offer.number}`);
    await safeSendMessage(trade.sellerId, `❌ لقد رفضت الصفقة\nتم إغلاق العرض.`);

    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }
    return bot.answerCallbackQuery(query.id, { text: 'تم رفض الصفقة' });
  }

  if (payload.type === 'admin_reject_seller') {
    const { offerId } = payload;

    // البحث عن العرض وصاحبه
    let seller, offer;
    for (const user of Object.values(userStates)) {
      if (!user?.offers) continue;
      offer = user.offers.find(o => o.id === offerId);
      if (offer) {
        seller = user;
        break;
      }
    }

    if (!offer || !seller || !offer.trade) {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ الصفقة غير موجودة'
      });
    }

    const { buyerId } = offer.trade;
    const buyer = userStates[buyerId];


    // حذف الصفقة
    delete offer.trade;

    // إزالة أي حجز مرتبط بالصفقة
    if (offer.locked) {
      offer.locked = false;
      delete offer.lockedBy;
    }

    await saveStorage();

    // إشعار المشرف
    await bot.editMessageText(
      '❌ تم رفض إثباتات البائع وإلغاء الصفقة',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );

    // إشعار البائع
    const sellerChatId = offer.userId || seller.userId || seller.chatId;
    if (sellerChatId) {
      await safeSendMessage(
        sellerChatId,
        `❌ تم رفض إثباتات التحويل الخاصة بك
  `
      );
    } else {
      console.error('admin_reject_seller: missing seller chat id', { offerId, seller });
    }

    // إشعار المشتري
    if (buyer) {
      await safeSendMessage(
        buyerId,
        `❌ تم إلغاء الصفقة
  بسبب رفض إثباتات البائع`
      );
    }

    return bot.answerCallbackQuery(query.id, {
      text: 'تم الرفض'
    });
  }


  // ========== BUYER DONE UPLOAD ==========
  if (payload.type === 'buyer_done_upload') {
    const { offerId } = payload;

    let offer;
    for (const u of Object.values(userStates)) {
      offer = u?.offers?.find(o => o.id === offerId);
      if (offer) break;
    }

    if (!offer?.trade) {
      return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });
    }

    const trade = offer.trade;

    if (query.from.id !== trade.buyerId) {
      return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح' });
    }

    // determine which proof array contains the uploaded files for this user
    let uploadedProofs = [];
    if (trade.buyerProofs && trade.buyerProofs.length && query.from.id === trade.buyerId) {
      uploadedProofs = trade.buyerProofs;
    } else if (trade.sellerProofs && trade.sellerProofs.length && query.from.id === trade.sellerId) {
      // fallback: files accidentally stored in sellerProofs
      uploadedProofs = trade.sellerProofs;
    }

    if (!uploadedProofs.length) {
      return bot.answerCallbackQuery(query.id, { text: '❗ لم ترسل أي إثبات' });
    }
    // حذف رسالة إنهاء الرفع الخاصة بالمشتري
    try { await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => { }); } catch (e) { }

    // اطلب من المشتري إرسال معلومات الدفع (مثل الباركود أو عنوان المحفظة)
    trade.step = 'wait_admin_buyer';

    await saveStorage();

    await safeSendMessage(
      APPROVE_REJECT_CHANNEL,
      `🧾 إثباتات المشتري
  👤 البائع: ${userStates[trade.sellerId]?.phone}
  👤 المشتري: ${userStates[trade.buyerId]?.phone}
  📦 الكمية: ${trade.quantity}
   المبلغ المطلوب: ${
      getPrice(offer.price, trade.quantity)
   }
  `
    );

    for (const p of uploadedProofs) {
      await bot.sendPhoto(APPROVE_REJECT_CHANNEL, p);
      await delay(300);
    }
    await safeSendMessage(
      trade.sellerId,
      `
      العرض رقم: ${offer.number}
      📦 الكمية التي ارسلتها:    ${trade.quantity} USDT
   المبلغ الذي استلمته: ${getPrice(offer.price, trade.quantity)}
   اذا استلمت المبلغ اضغط على زر تم الاستلام ادناه
   
   إذا لم تستلم المبلغ يرجى التواصل مع الدعم فوراً @Omrano2002
   `,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '✔️ تم الاستلام',
              callback_data: JSON.stringify({ type: 'seller_confirm_buyer', offerId })
            }
          ]]
        }
      }
    );
    // await safeSendMessage(
    //   APPROVE_REJECT_CHANNEL,
    //   'اختر الإجراء:',
    //   {
    //     reply_markup: {
    //       inline_keyboard: [[
    //         {
    //           text: '✔️ الإثباتات صحيحة',
    //           callback_data: JSON.stringify({ type: 'seller_confirm_buyer', offerId })
    //         },
    //         {
    //           text: '❌ رفض الإثباتات',
    //           callback_data: JSON.stringify({ type: 'admin_reject_buyer', offerId })
    //         }
    //       ]]
    //     }
    //   }
    // );

    // await safeSendMessage(
    //   trade.buyerId,
    //   `🏦 الرجاء إدخال معلومات الدفع الخاصة بك\n${offer.operation === 'شراء' ? 'يرجى ارسال عنوان المحفظة على السلسلة BEP20 فقط' : ''}\n📦 الكمية: ${trade.quantity}\nالمبلغ : ${trade.quantity * offer.price}`
    // );

  }

  // ========== FINALIZE TRADE ==========
  if (payload.type === 'finalize_trade') {
    const { offerId } = payload;

    let offer, seller;
    for (const u of Object.values(userStates)) {
      const found = u?.offers?.find(o => o.id === offerId);
      if (found) {
        offer = found;
        seller = u;
        break;
      }
    }

    if (!offer?.trade) {
      return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير موجودة' });
    }
    if (!offer.trade?.adminProofs || offer.trade.adminProofs.length === 0) {
      return bot.answerCallbackQuery(query.id, { text: '❌ لم يتم تحويل اثبات المشرف  الى البوت' });
    }

    // const trade = offer.trade;
    // const buyer = userStates[trade.buyerId];

    // trade.step = 'done';
    // offer.status = 'done';
    // seller.tradesCount = (seller.tradesCount || 0) + 1;
    // offer.trade = undefined;
    // await saveStorage();

    // await finishOffer(seller, offer);
    await finalizeTrade(offer, query.message.chat.id, query.message.message_id);
    // إرسال إثباتات البائع للمشتري

    // await safeSendMessage(trade.buyerId, '✅ تم تنفيذ الصفقة بنجاح');
    // await safeSendMessage(trade.sellerId, '✅ تم تنفيذ الصفقة بنجاح');

    // طلب تقييم الطرف الآخر من كلا الجانبين
    // try {
    //   await sendRatingRequest(trade.buyerId, trade.sellerId, offer.id);
    //   await sendRatingRequest(trade.sellerId, trade.buyerId, offer.id);
    // } catch (e) {
    //   console.error('sendRatingRequest failed', e);
    // }

    // await bot.editMessageText(
    //   '✅ تم إغلاق الصفقة بنجاح',
    //   {
    //     chat_id: query.message.chat.id,
    //     message_id: query.message.message_id
    //   }
    // );

    // return bot.answerCallbackQuery(query.id, { text: 'تم التنفيذ' });
  }

  // ===== Admin approves edit =====
  if (payload.type === callbackTypes.admin_approve_edit) {
    const { offerId } = payload;
    let owner, draft;
    for (const [uid, u] of Object.entries(userStates)) {
      if (u.pendingEdits && u.pendingEdits[offerId]) { owner = u; draft = u.pendingEdits[offerId]; owner._uid = uid; break; }
    }

    if (!owner || !draft) return bot.answerCallbackQuery(query.id, { text: '❌ لا يوجد تعديل معلق' });

    // find original offer
    const original = owner.offers.find(o => o.id === offerId);
    if (original) {
      original.status = 'rejected';
      await finishOffer(owner, original);
    }

    // create new offer based on draft
    const newOfferId = (userStates.forwardingNum || 0) + 1;
    userStates.forwardingNum = newOfferId;
    const newOffer = Object.assign({}, draft, { id: newOfferId, userId: Number(owner._uid), status: 'approved' });
    owner.offers.push(newOffer);

    // publish new offer to OFFERS_CHANNEL
    const pubMsg = await safeSendMessage(OFFERS_CHANNEL, formatOffer(owner, newOffer), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[StartOfferNowButton(newOffer.id)]] } });
    newOffer.publicMessageId = pubMsg.message_id;

    // cleanup pending edit
    delete owner.pendingEdits[offerId];
    await saveStorage();

    try {
      await bot.editMessageText('✅ تم نشر التعديل ونشر العرض الجديد', { chat_id: query.message.chat.id, message_id: query.message.message_id });
    } catch (e) { }

    try {
      await safeSendMessage(Number(owner._uid), `✅ تم قبول التعديل ونشر العرض الجديد
رقم العرض الجديد: ${newOffer.number}`);
    } catch (e) { }

    return bot.answerCallbackQuery(query.id, { text: 'تم النشر' });
  }

  // ===== Admin rejects edit =====
  if (payload.type === callbackTypes.admin_reject_edit) {
    const { offerId } = payload;
    let owner;
    for (const [uid, u] of Object.entries(userStates)) {
      if (u.pendingEdits && u.pendingEdits[offerId]) { owner = u; owner._uid = uid; break; }
    }

    if (!owner) return bot.answerCallbackQuery(query.id, { text: '❌ لا يوجد تعديل معلق' });

    delete owner.pendingEdits[offerId];
    await saveStorage();

    try {
      await bot.editMessageText('❌ تم رفض التعديل', { chat_id: query.message.chat.id, message_id: query.message.message_id });
    } catch (e) { }

    try { await safeSendMessage(Number(owner._uid), `❌ تم رفض تعديل عرضك رقم ${offerId}`); } catch (e) { }

    return bot.answerCallbackQuery(query.id, { text: 'تم الرفض' });
  }

  // ===== Cancel trade (admin action) =====
  if (payload.type === 'cancel_trade') {
    const { offerId } = payload;
    await cancelTrade(offerId);
  }

  if (payload.type === callbackTypes.transform_way) {
    const state = userStates[chatId]?.current;
    if (!state) return

    // If editing a draft, apply transform_way to the draft
    if (state.editDraft) {
      state.editDraft.transform_way = payload.data;
      await saveStorage();

      return safeSendMessage(
        chatId,
        formatPreview(state.editDraft),
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ إرسال التعديل للمشرف', callback_data: JSON.stringify({ type: callbackTypes.submit_edit, offerId: state.editingOfferId }) }],
              [{ text: '❌ إلغاء', callback_data: JSON.stringify({ type: callbackTypes.cancel_offer, offerId: state.editingOfferId }) }]
            ]
          }
        }
      );
    }

    state.transform_way = payload.data;
    await saveStorage();

    return safeSendMessage(
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


  if (payload.type === callbackTypes.approve) {
    const { userId } = payload;
    let offerId = payload.offerId
    const user = userStates[userId];
    if (!user) return;



    const offer = user.offers.find(o => o.id === offerId);
    if (!offer || offer.status !== 'pending') return;

    offer.status = 'approved';
    userStates.offerSeq = (userStates.offerSeq || 0) + 1;
    offer.number = userStates.offerSeq

    await saveStorage();

    await bot.editMessageText(
      formatOffer(user, offer, '\n✅  تم قبول العرض', false, true),
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML',}
      //   reply_markup: {
      //     inline_keyboard: [
            // [
            // {
            //   text: '✅ تم التنفيذ',
            //   callback_data: JSON.stringify({
            //     type: callbackTypes.done,
            //     userId,
            //     offerId
            //   })
            // },
          //  [{ text: '❌ رفض', callback_data: JSON.stringify({ type: callbackTypes.reject, userId, offerId }) }]
          // ]
        // }
      // }
    );

    await safeSendMessage(userId, `
      ✅ تم قبول عرضك ونشره
      رقم العرض هو : ${offer.number}
      `);
    const pubMsg = await safeSendMessage(
      OFFERS_CHANNEL,
      formatOffer(user, offer),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            StartOfferNowButton(offer.id)
          ]]
        }
      }
    );

    offer.publicMessageId = pubMsg.message_id;
    await saveStorage();

    // ============ matches offer ==

    const matches = findMatchingOffers(offer, userId);

    if (matches.length) {
      for (const m of matches) {
        offer.matchedWith = {
          userId: m.userId,
          offerId: m.offer.id
        };

        m.offer.matchedWith = {
          userId,
          offerId: offer.id
        };
        await safeSendMessage(
          userId,
          `🎯 تم العثور على عرض مطابق:\n\n${formatOffer(userStates[m.userId], m.offer)}`,
          {
            parse_mode: 'HTML', reply_markup: {
              inline_keyboard: [[
                StartOfferNowButton(m.offer.id)
              ]]
            }
          }
        );
        await delay(300)
      }
    }
    await saveStorage();
    return bot.answerCallbackQuery(query.id);

  }

  if (payload.type == callbackTypes.start_trade) {
    const offerId = payload.offerId;
    const userA = userStates[query.from.id];
    if (!userA) return;

    const offerA = userA.offers.find(o => o.id === offerId);
    if (!offerA || !offerA.matchedWith) return;

    const userB = userStates[offerA.matchedWith];
    if (!userB) return;

    // البحث عن العرض المقابل
    const CurrentOffers = userB.offers.filter(ele => ele.status !== 'done' && ele.status !== 'rejected');
    if (CurrentOffers.length == 0) return
    const offerB = CurrentOffers.find(o => o.matchedWith === query.from.id);
    if (!offerB) return;
    // حماية من التكرار
    if (offerA.status === 'done' || offerB.status === 'done') {
      return bot.answerCallbackQuery(query.id, { text: '❗ الصفقة منتهية' });
    }
    if (offerA.locked || offerB.locked) {
      return bot.answerCallbackQuery(query.id, { text: '❌ أحد العرضين محجوز حالياً' });
    }


    userA.tradesCount = (userA.tradesCount || 0) + 1;
    userB.tradesCount = (userB.tradesCount || 0) + 1;
    // إنهاء العرضين
    offerA.status = 'done';
    offerB.status = 'done';
    await saveStorage();

    await finishOffer(userA, offerA);
    await finishOffer(userB, offerB);

    // ⭐ طلب تقييم
    await sendRatingRequest(query.from.id, offerA.matchedWith, offerA.id);
    await sendRatingRequest(offerA.matchedWith, query.from.id, offerB.id);

    return bot.answerCallbackQuery(query.id, { text: 'تم بدء الصفقة' });
  }

  // ====== DONE ========
  if (payload.type === callbackTypes.done) {
    const { userId, offerId } = payload;
    const user = userStates[query.from.id]

    if (!user) return;

    const offer = user.offers.find(o => o.id === offerId);
    if (!offer || offer.status === 'done') return;

    offer.status = 'done';
    await saveStorage();


    await finishOffer(user, offer);

    await safeSendMessage(userId, `
      ☑️ تم تنفيذ العرض بنجاح
      رقم العرض هو : ${offer.number}
      `);

 

    await saveStorage()

    return bot.answerCallbackQuery(query.id, { text: 'تم التنفيذ' });
  }


  //#region  REJECT =====
  if (payload.type === callbackTypes.reject) {
    const { userId, offerId } = payload;
    console.log('rejecteee', payload);
    const user = userStates[userId];
    if (!user) return;

    const offer = user.offers.find(o => o.id === offerId);
    // if (!offer || offer.status !== 'pending') return;
    if (!offer) return;

    offer.status = 'rejected';
    await saveStorage();
    await finishOffer(user, offer)
    await safeSendMessage(userId, `❌ تم رفض عرضك \n رقم ${offer.number}`);
    return bot.answerCallbackQuery(query.id, { text: 'تم رفض العرض' });
  }

  //#region  MANAGE_OFFERS ========
  if (payload.type === 'manage_offers') {
    const user = userStates[query.from.id];
    
    if (!user || user.offers.length===0) {
      
      return await safeSendMessage(chatId,  'لا توجد عروض' );
    }
    const CurrentOffers = user.offers.filter(ele => ele.status !== 'done' && ele.status !== 'rejected')
if(CurrentOffers.length===0){
  return await safeSendMessage(chatId,  'لا توجد عروض حالية' );
}
    CurrentOffers.forEach(o => {
      const message = formatPreview(o, `
        📩 العرض رقم: ${o.number}
        حالة العرض : ${status[o.status]}
        `)

      safeSendMessage(chatId, message, {

        reply_markup: {
          inline_keyboard: [[
            { text: '✏️ تعديل', callback_data: JSON.stringify({ type: callbackTypes.edit_offer, offerId: o.id }) },
            { text: '🗑 حذف', callback_data: JSON.stringify({ type: callbackTypes.delete_offer, offerId: o.id }) }
          ]]
        }
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
  //  =========== Remove_OFFERS =============
  if (payload.type === callbackTypes.remove_offer) {
    const { userId, offerId } = payload;
    const user = userStates[userId];
    if (!user) return;

    const offerIndex = user.offers.findIndex(o => o.id === offerId);
    if (offerIndex < 0) return;

    const offer = user.offers[offerIndex];

    // 🗑 حذف رسالة قناة التشييك
    if (offer.checkMessageId) {
      try {
        await bot.deleteMessage(CHECK_CHANNEL, offer.checkMessageId);
      } catch (e) {
        console.error('Failed to delete check message:', e.message);
      }
    }

    // 🗑 حذف رسالة قناة العروض (إن وجدت)
    if (offer.publicMessageId) {
      try {
        await bot.deleteMessage(OFFERS_CHANNEL, offer.publicMessageId);
      } catch (e) {
        console.error('Failed to delete public message:', e.message);
      }
    }

    // 🗑 حذف العرض من التخزين
    user.offers.splice(offerIndex, 1);
    await saveStorage();

    // 📩 إشعار المستخدم
    await safeSendMessage(userId, `❌ تم رفض عرضك\nرقم الإحالة: ${offerId}`);

    return bot.answerCallbackQuery(query.id, { text: 'تم حذف العرض نهائياً' });
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
    await saveStorage();


    // قناة التشييك
    await bot.editMessageText(formatOffer(user, offer, 'تم إلغاء العرض ❌', true, true), {
      chat_id: CHECK_CHANNEL,
      message_id: offer.checkMessageId,
      parse_mode: 'HTML'
    });

    // قناة العروض
    if (offer.publicMessageId) {
      await bot.editMessageText(formatOffer(user, offer, '', true), {
        chat_id: OFFERS_CHANNEL,
        message_id: offer.publicMessageId,
        parse_mode: 'HTML'
      });
    }
    return bot.editMessageText(`${payload.deleteMessageForUser ?? '🗑 تم حذف العرض بنجاح  '}`, {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  }

  if (payload.type === 'info') {
    const chatId = query.from.id
    safeSendMessage(
      chatId,
      `
    كل ما تحتاجه في مكان واحد:

💎 عن البوت:
وساطة مالية آمنة لتداول USDT و شام كاش دولار بسرعة وعمولة منخفضة
⏱️ مدة المعاملة: 1 ساعة فقط
🔒 ضمان الوسيط | ⚡️ تنفيذ سريع
📢 قناتنا: https://t.me/+TTiTDqauR01kYzM0

🆘 الدعم الفني :

📞 @Omrano2002

  ترتيب فئات العملاء  كالآتي :
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
              callback_data: JSON.stringify({ type: 'back' })
            }
          ]]
        }
      }
    );

  }
  if (payload.type === 'profile') {
    const chatId = query.from.id;
    const user = userStates[chatId];
    if (!user) return;
    const avgRating = user.ratings?.length
      ? (user.ratings.reduce((a, b) => a + Number(b.rate), 0) / user.ratings.length).toFixed(1)
      : 'لا يوجد';

    safeSendMessage(
      chatId,
      `👤 ملفك الشخصي

🏷 الفئة: ${getCategory(user.tradesCount)}
📊 عدد المعاملات: ${user.tradesCount || 0}
⭐️ التقييم: ${avgRating} / 5
💬 عدد المقيّمين: ${user.ratings?.length || 0}
`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '⬅️ رجوع', callback_data: JSON.stringify({ type: 'back' }) }
          ]]
        }
      }
    );
  }


  if (payload.type === 'back') {
    await bot.deleteMessage(
      query.message.chat.id,
      query.message.message_id
    );

    return bot.answerCallbackQuery(query.id);
  }


});

//#region FUNCTIONS ==================
function isValidNumber(value) {
  return !isNaN(value) && value !== '';
}

async function sendOfferForReview(chatId, messageId) {
  // if bot disabled, refuse creating new offers
  if (!userStates.botEnabled) {
    await safeSendMessage(chatId, '⛔ البوت متوقف مؤقتاً. حاول لاحقاً.');
    return;
  }

  const user = userStates[chatId];
  if (!user) return;
  userStates.forwardingNum = (userStates.forwardingNum || 0) + 1;
  const offerId = userStates.forwardingNum;

  const offer = {
    id: offerId,
    ...user.current,
    status: 'pending',
    userId: chatId,
    checkMessageId: null,   // قناة التشييك
    publicMessageId: null,
    userId: chatId,      // صاحب العرض
    matchedWith: null,   // 🆕 الطرف الآخر
    rated: false,
  };

  user.offers.push(offer);
  user.current = {};


  const sent = await safeSendMessage(CHECK_CHANNEL, formatOffer(user, offer, "", false, true), {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ قبول', callback_data: JSON.stringify({ type: callbackTypes.approve, userId: chatId, offerId }) },
        { text: '❌ رفض', callback_data: JSON.stringify({ type: callbackTypes.remove_offer, userId: chatId, offerId }) }
      ]]
    },
    parse_mode: 'HTML'
  });
  offer.checkMessageId = sent.message_id;
  bot.editMessageText(`⏳ تم إرسال عرضك للمراجعة
  رقم الإحالة هو ${offerId}`, {
    chat_id: chatId,
    message_id: messageId
  });
  await saveStorage();
}

function formatOffer(user, offer, statusText = '', isCenterLine = false, viewName = false) {

  const text = `
  📩 العرض رقم: ${offer.number}
  
  🔁 العملية: ${offer.operation} USDT  ${offer.operation == "بيع" ? "🔴" : "🟢"}
  📦 الكمية: ${offer.minQuantity} الى ${offer.maxQuantity}
  💰 السعر: ${offer.price}
💳 طريقة الدفع: ${transform_way[offer.transform_way]}
👤 فئة العميل: ${getCategory(user.tradesCount)}
${user.verified ? '✅ حساب موثق' : ''}

عمولة الوسيط: (00)
ملاحظة : بمناسبة افتتاح البوت  عمولة صفر اخي قد ما كانت الكمية  عندك 🎊 🔥 🔥 🔥 🔥 🔥
كما يمكنك انشاء عروضك عن طريق البوت المميز @omran2002_bot
${statusText}
${viewName ? `الاسم : ${user?.first_name + " " + user?.last_name} 
الرقم : ${user?.phone}` : ''}
`;

  // إذا تم تنفيذ العرض → شطب النص
  return isCenterLine ? `
  <s>${text}</s>
  ❌ تم إغلاق العرض
  ` : text;
}
function sendWelcomeMessage(chatId, msg) {
  const keyboard = [[
    { text: '➕ إنشاء عرض USDT', callback_data: JSON.stringify({ type: callbackTypes.ways, data: 'create_usdt' }) },
  ], [
    { text: '📂 إدارة عروضي', callback_data: JSON.stringify({ type: 'manage_offers' }) },
  ], [
    { text: '😎 ملفي الشخصي', callback_data: JSON.stringify({ type: 'profile' }) }
  ], [
    { text: 'معلومات حول البوت', callback_data: JSON.stringify({ type: 'info' }) }
  ]
  ]
  if (!userStates[chatId]?.verified)
    keyboard.push([{ text: '🔐 توثيق الحساب', callback_data: JSON.stringify({ type: callbackTypes.verify_me }) }])
  safeSendMessage(chatId, ` أهلاً بك يا ${msg.chat.first_name} في بوت alkelani p2p  للوساطة المالية — منصتك الذكية للتداول السريع والآمن

    🛍 الآن أصبح بإمكانك بيع وشراء USDT مقابل كل وسائل الدفع السورية المتاحة وبإمكانك ايضا بيع وشراء شام كاش دولار بكل سهولة
    
    ⚡️ واجهة سلسة، عروض مباشرة، وصفقات تنجز بثوانٍ
    🛡️ أمان، شفافية، وتجربة تداول مصممة خصيصاً لك
    
    🔄 تنقّل بين العملات، اغتنم الفرص، وكن دائماً في قلب السوق
    
    ⌚️ انطلق الآن وكن جزءاً من مجتمع يعرف قيمة الوقت والقرار  
`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

function formatPreview(offer, title = "📋 *تأكيد بيانات العرض*") {
  const o = offer;

  return `
${title}

🔁 العملية: ${o.operation} USDT ${o.operation == "بيع" ? "🔴" : "🟢"}
💰 السعر: ${o.price}
📦 الكمية: ${o.minQuantity}  الى ${o.maxQuantity}
💳 طريقة الدفع: ${transform_way[o.transform_way]}

`;
}

async function loadStorage() {
  try {
    const res = await fetch(`${GH_API}?ref=${GH.branch}`, {
      headers: { Authorization: `token ${GH.token}` }
    });

    if (res.status === 404) return { offerSeq: 0 };

    const data = await res.json();
    return JSON.parse(Buffer.from(data.content, 'base64').toString());
  } catch (e) {
    console.error('❌ Load storage failed:', e.message);
    return { offerSeq: 0 };
  }
}

async function saveStorage() {
  const res = await fetch(`${GH_API}?ref=${GH.branch}`, {
    headers: { Authorization: `token ${GH.token}` }
  });

  const old = res.status === 200 ? await res.json() : null;

  await fetch(GH_API, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GH.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Update storage.json from Railway bot',
      content: Buffer.from(JSON.stringify(userStates, null, 2)).toString('base64'),
      branch: GH.branch,
      ...(old?.sha && { sha: old.sha })
    })
  });

}


async function finishOffer(user, offer) {
  // console.log('amm', user.id, offer);

  // قناة التشييك
  await safeEditMessageText(formatOffer(user, offer, '', true, true), {
    chat_id: CHECK_CHANNEL,
    message_id: offer.checkMessageId,
    parse_mode: 'HTML'
  });

  // قناة العروض

  if (offer.publicMessageId) {
    await safeEditMessageText(formatOffer(user, offer, '', true), {
      chat_id: OFFERS_CHANNEL,
      message_id: offer.publicMessageId,
      parse_mode: 'HTML'
    });
  }


}

function findMatchingOffers(newOffer, ownerUserId) {
  const matches = [];

  for (const [uid, user] of Object.entries(userStates)) {
    if (uid === 'offerSeq') continue;
    if (+uid === ownerUserId) continue;
    if (!user.offers?.length) continue;

    user.offers.forEach(o => {
      if (
        o.status !== 'approved' ||
        o.status === 'done' ||
        o.transform_way !== newOffer.transform_way ||
        o.operation === newOffer.operation
      ) return;

      // الكمية
      const qtyOk =
        Number(newOffer.minQuantity) <= Number(o.maxQuantity) &&
        Number(newOffer.maxQuantity) >= Number(o.minQuantity);

      if (!qtyOk) return;

      // السعر
      const priceOk =
        newOffer.operation === 'بيع'
          ? Number(newOffer.price) <= Number(o.price)
          : Number(newOffer.price) >= Number(o.price);

      if (!priceOk) return;

      matches.push({
        userId: uid,
        offer: o
      });
    });
  }

  return matches;
}

async function sendRatingRequest(chatId, targetUserId, offerId) {
  // حماية من القيم الفارغة
  if (!chatId || !targetUserId || !offerId) return;
  const keyboard = [];
  [1, 2, 3, 4, 5].forEach(stars => {
    keyboard.push([{
      // نص الزر
      text: '⭐'.repeat(stars),

      // بيانات مختصرة (أقل من 64 بايت)
      callback_data: `rate:${stars}:${targetUserId}:${offerId}`
    }])
  })
  await safeSendMessage(
    chatId,
    '⭐️ كيف تقيّم التاجر الآخر؟',
    {
      reply_markup: {
        inline_keyboard: keyboard
      }
    }
  );
}

async function safeSendMessage(chatId, text, options = {}, retry = 2) {
  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (err) {
    if (retry > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return bot.sendMessage(chatId, text, options, retry - 1);
    }
    console.error('sendMessage failed:', err.code);
  }
}

async function delay(ms) {
  return await new Promise(resolve => setTimeout(resolve, ms));
}



function startOfferFlow(chatId, offerId) {
  const offerOwner = Object.values(userStates)
    .find(u => u?.offers?.some(o => o.id === offerId));

  if (!offerOwner) {
    return safeSendMessage(chatId, '❌ العرض غير موجود');
  }

  const offer = offerOwner.offers.find(o => o.id === offerId);
  if (!offer) {
    return safeSendMessage(chatId, '❌ العرض انتهى');
  }

  if (offer.userId === chatId) {
    return safeSendMessage(chatId, '❌ لا يمكنك حجز عرضك الخاص');
  }

  userStates[chatId].current = {
    step: 'ask_quantity',
    offerId,
    offerOwnerId: offer.userId
  };
  console.log('offerOwnerId', offer.userId);

  safeSendMessage(
    chatId,
    `
    العرض الذي اخترته هو: ${offer.number}
    📦 أدخل الكمية المطلوبة\n

الحد الأدنى: ${offer.minQuantity}
الحد الأعلى: ${offer.maxQuantity}`
  );
}



function addStrike(user) {
  const now = Date.now();
  user.strikes = user.strikes || { count: 0, history: [] };

  user.strikes.history.push(now);

  // آخر 7 أيام
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  user.strikes.history = user.strikes.history.filter(t => t >= weekAgo);
  user.strikes.count = user.strikes.history.length;

  if (user.strikes.count >= 5) {
    user.blocked = true;
  }
}

function StartOfferNowButton(offerId) {

  return {
    text: '▶️ احجز الآن',
    url: `https://t.me/omran2002_bot?start=offer_${offerId}`
  }
}


function isOperatoinSell(offer) {
  return offer.operation === 'بيع';
}

async function cancelTrade(offerNumber) {
  if (!offerNumber) return;
  let offer, sellerUser;
  for (const u of Object.values(userStates)) {
    const found = u?.offers?.find(o => o.number === offerNumber);
    if (found) { offer = found; sellerUser = u; break; }
  }

  // if (!offer || !offer.trade) return bot.answerCallbackQuery(query.id, { text: '❌ الصفقة غير  موجودة' });
  console.log('offer trade', offer);

  if (!offer || !offer.trade) return;

  const trade = offer.trade;


  // حذف الصفقة من التخزين
  delete offer.trade;
  // إزالة الحجز عند إلغاء الصفقة
  if (offer.locked) {
    offer.locked = false;
    delete offer.lockedBy;
  }

  // تعديل رسالة المشرف
  try {
    await bot.editMessageText('❌ تم إلغاء الصفقة من قبل المشرف', {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });
  } catch (e) { }

  // إشعار الطرفين
  try { await safeSendMessage(trade.buyerId, `❌ تم إلغاء الصفقة رقم ${offer.number}`); } catch (e) { }
  try { await safeSendMessage(trade.sellerId, `❌ تم إلغاء الصفقة رقم ${offer.number}`); } catch (e) { }
  try { await safeSendMessage(APPROVE_REJECT_CHANNEL, `❌ تم إلغاء الصفقة رقم ${offer.number}`); } catch (e) { }

  offer.trade = undefined
  await saveStorage();
}

function formatTradeStatus(offer) {
  if (!offer.trade) return '';
  const stepText = TradeStepsAR[offer.trade.step] || 'غير معروف';

  return `
🧾 عرض رقم: ${offer.number}
━━━━━━━━━━━━
👤 البائع: <code>${userStates[offer.trade.sellerId]?.phone}</code>
👤 المشتري: <code>${userStates[offer.trade.buyerId]?.phone}</code>

📍 الحالة الحالية:
➡️ ${stepText}

${offer.trade.step}
`;
}

function findOfferByNumber(number) {
  for (const user of Object.values(userStates)) {
    if (!user?.offers) continue;

    const offer = user.offers.find(o => o.number === number);
    if (offer) return offer;
  }
  return null;
}




async function getAllActiveTrades() {
  const trades = [];

  for (const [userId, userData] of Object.entries(userStates.users || {})) {
    const trade = userData?.offer?.trade;

    if (trade && typeof trade === "object" && Object.keys(trade).length > 0) {
      trades.push({
        userId,
        offer: userData.offer,
        ...trade
      });
    }
  }

  return trades;
}
async function finishAllOffer() {
  // console.log('hi hiiiiii', userStates);

  for (const [userId, userData] of Object.entries(userStates || {})) {
    const offers = userData?.offers;
    if (Array.isArray(offers) && offers.length >0) {


      for (const offer of offers) {
              await finishOffer(userData, offer);
              await delay(300);
            }
          }
      
          userStates[userId].offers = [];
      
          await saveStorage();
      
            await safeSendMessage(
              userId,
              `✅ تم إغلاق جميع عروضك من قبل المشرف
      لضبط حركة السوق اليومية`
            );
        }
      
      return safeSendMessage(
        OFFERS_CHANNEL,
        `  تم اغلاق جميع العروض القديمة لضبط حركة السوق اليومية 🎯🎯`
      );

}


async function finalizeTrade(offer, chat_id, message_id) {
  if (!offer) return;

  // صاحب العرض الأساسي
  const sellerUser = userStates[offer.userId];
  if (!sellerUser) return;

  let buyerUser = null;
  let matchedOffer = null;

  // ===== تحديد نوع الصفقة =====
  if (offer.matchedWith && typeof offer.matchedWith === 'object') {
    // 🔵 صفقة مطابقة عرضين
    buyerUser = userStates[offer.matchedWith.userId];
    matchedOffer = buyerUser?.offers?.find(o => o.id === offer.matchedWith.offerId);

    if (!buyerUser || !matchedOffer) return;

    // حماية من التكرار
    if (offer.status === 'done' || matchedOffer.status === 'done') return;

  } else {
    // 🟢 صفقة عرض واحد
    if (!offer.trade) return;

    buyerUser = userStates[offer.trade.buyerId];
    if (!buyerUser) return;
  }

  // ===== تحديث الإحصائيات =====
  sellerUser.tradesCount = (sellerUser.tradesCount || 0) + 1;
  buyerUser.tradesCount = (buyerUser.tradesCount || 0) + 1;

  // ===== إغلاق العرض/العروض =====
  offer.status = 'done';

  if (matchedOffer) {
    matchedOffer.status = 'done';
  }
  console.log('offer', offer, 'matechdd', matchedOffer);
  const trade = offer.trade;
  if (!trade.adminProofs || !trade.buyerProofs) return
  for (const p of trade.adminProofs) {
    await bot.sendPhoto(trade.buyerId, p);
    await delay(300);
  }

  const {buyerId, sellerId} = trade;
  // إرسال إثباتات المشتري للبائع
  for (const p of trade.buyerProofs) {
    await bot.sendPhoto(trade.sellerId, p);
    await delay(300);
  }

  // ===== تنظيف بيانات الصفقة =====
  if (offer.trade) {
    offer.trade.step = 'done';
    offer.trade = undefined;
  }

  if (matchedOffer?.trade) {
    matchedOffer.trade = undefined;
  }

  await saveStorage();

  // ===== تحديث القنوات =====
  await finishOffer(sellerUser, offer);

  if (matchedOffer) {
    await finishOffer(buyerUser, matchedOffer);
  }

  // ===== الإشعارات =====


  await safeSendMessage(sellerId, `
    ✅ تم تنفيذ الصفقة  ${offer.number} بنجاح
   
    `);
  await safeSendMessage(buyerId, `✅ تم تنفيذ الصفقة ${offer.number} بنجاح`);
  await bot.editMessageText(
    `✅ تم إغلاق الصفقة بنجاح
          رقم العرض: ${offer.number}
          رقم العرض المطابق: ${matchedOffer ? matchedOffer.number : 'N/A'}
      `,
    {
      chat_id,
      message_id
    }
  );

  // ===== طلب التقييم =====
  try {
    
    await sendRatingRequest(buyerId, sellerId, offer.id);
    await sendRatingRequest(sellerId,buyerId, offer.id);
  } catch (e) {
    console.error('sendRatingRequest error', e);
  }
}


async function safeEditMessageText(text, options) {
  try {
    await bot.editMessageText(text, options);
  } catch (err) {
    if (
      err.response?.body?.description?.includes('message is not modified')
    ) {
      return; // تجاهل الخطأ
    }
    throw err; // أي خطأ آخر مهم
  }
}

async function removeOfferByAdmin(offerNumber) {
  for (const [userId, userData] of Object.entries(userStates || {})) {
    if (!Array.isArray(userData.offers)||userData.offers.length === 0) continue;

    const index = userData.offers.findIndex(o => o.number == offerNumber);
    if (index === -1) continue;

    const offer = userData.offers[index];

    // حذف العرض
    userData.offers.splice(index, 1);
    await saveStorage();
    await finishOffer(userData, offer);
    // إشعار صاحب العرض
    await safeSendMessage(
      userId,
      `❌ تم حذف عرضك من قبل المشرف
رقم العرض: ${offer.number }`
    );

    // إشعار المشرف
    await safeSendMessage(
      CHECK_CHANNEL,
      `✅ تم حذف العرض بنجاح
User ID: ${userId}
Offer: ${offer.number}`
    );

    return true;
  }

  return false;
}

function getCategory(tradesCount) {
  if (tradesCount >= 30) return '👑 ملكي' ;
  if (tradesCount >= 15) return '🥇 ذهبي' ;
  if (tradesCount >= 5) return '🥈 فضي'  ;
  return '🥉 برونزي' ;
}

function getPrice(price,qty){
  return (Number(price) * Number(qty)).toFixed(2) ;
}