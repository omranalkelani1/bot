
// });

const TelegramBot = require('node-telegram-bot-api');

// ======== إعدادات البوت ========
const token = '8451392820:AAGYDwYGIgiVUK81BK2Q3A0WppaHdMFnS-s';                 // توكن البوت
const checkChannel = '@usdtB2026';    // القناة التي يجب أن يكون المستخدم عضوًا فيها
const targetChannel = '@usdtB2026';  // القناة التي ستستقبل البيانات
const fs = require('fs');
const bot = new TelegramBot(token, { polling: true });
console.log('✅ البوت يعمل وجاهز لاستقبال الرسائل...');

// لتخزين حالة كل مستخدم
let userStates = JSON.parse(fs.readFileSync('./storage.json', 'utf8'));
const callbackTypes = {
  sellOrBuy: 'sellOrBuy',
  transform_way: 'transform_way',
  ways: 'ways'
}
// ======== خطوة البداية ========
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // console.log('ff',Object.keys(transform_way).includes('fuad'));

  try {
    // التحقق من انضمام المستخدم للقناة
    const chatMember = await bot.getChatMember(checkChannel, userId);

    if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
      console.log('h',!userStates[chatId]);
      
      if (!userStates[chatId] ||  userStates[chatId].phone == null) {
      bot.sendMessage(chatId, "✅ أنت مشترك في القناة! الرجاء مشاركة رقم هاتفك:", {
        reply_markup: {
          keyboard: [[{ text: "📱 مشاركة رقمي", request_contact: true }]],
          one_time_keyboard: true
        }
      });
  userStates[chatId] = {
    phone: null,
    offers: [],
    current: { step: 'askPhone' }
  };
} else {
  sendWelcomeMessage(chatId,msg)
  userStates[chatId]= JSON.parse(fs.readFileSync('./storage.json', 'utf8'))[chatId];
  userStates[chatId].current = { step: 'askPhone' };
}
    } else {
      bot.sendMessage(chatId, `❌ يجب عليك الانضمام أولاً إلى القناة: ${checkChannel}`);
    }
  } catch (err) {
    console.error('askPhone :', err);
    bot.sendMessage(chatId, "❌ حدث خطأ أثناء التحقق من اشتراكك. تأكد من أن البوت مشرف في القناة.");
  }
});



// ======== استقبال باقي البيانات خطوة بخطوة ========
bot.on('message', (msg) => {

  //     // تجاهل الرسائل التي هي أوامر 
  if (msg.text && msg.text.startsWith('/')) return;


  const chatId = msg.chat.id;
  const state = userStates[chatId].current;
  console.log('message', state, msg.text);
  if (!state) return;
  if (state.step === 'askPhone' && msg.contact) {
    userStates[chatId].phone = msg.contact.phone_number;
    sendWelcomeMessage(chatId,msg);
    //   bot.sendMessage(chatId, "✅ اختر نوع العملية:", {
    //       reply_markup: {
    //       keyboard: [
    //           [{ text: "بيع" }, { text: "شراء" }]
    //         ],
    //         one_time_keyboard: true, // يخفي لوحة المفاتيح بعد الضغط
    //         resize_keyboard: true
    //     }
    // });
    // state.step = 'askOperation';
    // return
  }


  if (state.step === 'askPrice') {
    state.price = msg.text;
    bot.sendMessage(chatId,
      `تم حفظ السعر  : ${state.price} 
        
        ────────────────────
        الآن أدخل الحد الأدنى للكمية:`
    );
    state.step = 'askMinQuantity';
    return;
  }

  if (state.step === 'askMinQuantity') {
    state.minQuantity = msg.text;
    bot.sendMessage(chatId,
      ` تم حفظ الحدالأدنى  : ${msg.text} 
        
        ────────────────────
        الآن أدخل الحد الأعلى للكمية:`
    );
    state.step = 'askMaxQuantity';
    return
  }
  if (state.step === 'askMaxQuantity') {
    state.maxQuantity = msg.text;
    bot.sendMessage(chatId,
      `تم حفظ الحد الأعلى : ${msg.text} 
        
        ────────────────────
        الآن أدخل طريقة الدفع:`
      , {
        reply_markup: {
          inline_keyboard:
            Object.entries(transform_way).map(([key, value]) =>
              [
                { text: value, callback_data: JSON.stringify({ type: callbackTypes.transform_way, data: key }) },
              ]
            )


        }
      });

  }

});

// ثم handler للـ callback بيع أو شراء
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = JSON.parse(query.data).data;
  const type = JSON.parse(query.data).type;
  console.log('d', data, '/////     t:', type);

  switch (type) {
    case callbackTypes.ways:
      if (data === "create_usdt") {
        const createOfferMsg = `اختار نوع العملية التي تريد القيام بها بها 🌟

:ملاحظة هامة ⚠️
يرجى عدم إنشاء عروض وهمية أو غير حقيقية، لأن ذلك قد يؤدي إلى حظر حسابك حفاظاً على سلامة الخدمة للجميع.

خيارات متاحة لك 🔥

• USDT بيع 🔴
  - حدد السعر الذي تبيعه به
  - حدد أعلى وأقل كمية مقبولة
  - حدد طريقة الاستلام بالليرة السورية

• USDT شراء 🟢
  - حدد السعر الذي تشتري به
  - حدد أعلى وأقل كمية مقبولة
  - حدد طريقة الدفع بالليرة السورية

:الآن ماذا تريد أن تبدأ؟ ✨`;

        const inlineReply = {
          inline_keyboard: [
            [{ text: "أريد بيع USDT 🔴", callback_data: JSON.stringify({ type: callbackTypes.sellOrBuy, data: "sell_usdt" }) }],
            [{ text: "أريد شراء USDT 🟢", callback_data: JSON.stringify({ type: callbackTypes.sellOrBuy, data: "buy_usdt" }) }],
            // [{ text: "العودة ↩️", callback_data: JSON.stringify({type:callbackTypes.ways,data:"back_to_main"}) }]
          ]
        };

        await bot.editMessageText(createOfferMsg, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: inlineReply
        });
      }

      break;
    case callbackTypes.sellOrBuy:
      if (data === "sell_usdt") {
        askOperation(chatId, "بيع")
      }
      if (data === "buy_usdt") {
        askOperation(chatId, "شراء")
      }
      break;
    case callbackTypes.transform_way:

      if(data == 'saveData'){
        return sendDataToChannel(chatId)
      }
      const msgId = query.message.message_id;
      userStates[chatId].current.transform_way = data;
      const keyboard = Object.entries(transform_way).map(([key, value]) =>
        [
          { text: key === data ? `✅ ${value}` : value, callback_data: JSON.stringify({ type: callbackTypes.transform_way, data: key }) },
        ]
      )
      keyboard.push(
        [{ text: "تأكيد جميع المعلومات ✅", callback_data: JSON.stringify({ type: callbackTypes.transform_way, data: 'saveData' }) }])

      bot.editMessageReplyMarkup(
        { inline_keyboard: keyboard },
        { chat_id: chatId, message_id: msgId }
      );
      // bot.answerCallbackQuery(query.id);
      break;
    default:
      break
  }
})
function askOperation(chatId, msg) {
  const state = userStates[chatId].current
  if (!state) return
  state.operation = msg;
  bot.sendMessage(chatId,
    `اخترت ${msg} USDT
            
            ────────────────────
            الآن أدخل السعر المطلوب:`
  );
  state.step = 'askPrice';
}


const transform_way = {
  haram: 'الهرم',
  fuad: 'الفؤاد',
  shamDolar: ' (دولار) شام كاش',
  shamSy: ' (سوري) شام كاش',
  mtn: 'ام تي ان كاش',
  syriatel: 'سيرياتل كاش',
  kadmos: 'القدموس',
}

//     // إرسال كل البيانات إلى القناة المستقبلة
async function sendDataToChannel(chatId) {
  const state  = userStates[chatId].current
  const messageToChannel = `
  📩العرض رقم: ${userStates.count + 1}
  العميل يرغب ${state.operation} usdt ${state.operation =="بيع"?"🔴":"🟢"}
  - رقم الهاتف: ${state.phone}
  - الكمية: ${state.maxQuantity} إلى  ${state.minQuantity}  
  - السعر: ${state.price}
  -طريقة الدفع : ${transform_way[state.transform_way]}
  - فئة العميل : ${state.category}

  - عمولة الوسيط : 300$/0.25$ 
      `;
  bot.sendMessage(targetChannel, messageToChannel);

  // رسالة تأكيد للمستخدم
  bot.sendMessage(chatId, "✅ تم حفظ جميع المعلومات وإرسالها بنجاح!");
  userStates.count += 1;

  // إعادة تعيين الحالة
  userStates[chatId].offers.push({ ...state });
 await fs.writeFileSync('./storage.json', JSON.stringify(userStates, null, 2), 'utf8');
   userStates[chatId].current={};
}

function sendWelcomeMessage(chatId,msg) {
     bot.sendMessage(chatId, ` أهلاً بك يا ${msg.chat.first_name} في بوت USDTSY للوساطة المالية — منصتك الذكية للتداول السريع والآمن

    🛍 الآن أصبح بإمكانك بيع وشراء USDT مقابل كل وسائل الدفع السورية المتاحة وبإمكانك ايضا بيع وشراء شام كاش دولار بكل سهولة
    
    ⚡️ واجهة سلسة، عروض مباشرة، وصفقات تنجز بثوانٍ
    🛡️ أمان، شفافية، وتجربة تداول مصممة خصيصاً لك
    
    🔄 تنقّل بين العملات، اغتنم الفرص، وكن دائماً في قلب السوق
    
    ⌚️ انطلق الآن وكن جزءاً من مجتمع يعرف قيمة الوقت والقرار   `, {
      reply_markup: {
        inline_keyboard: [[
          { text: "انشاء عرض usdt", callback_data: JSON.stringify({ type: callbackTypes.ways, data: "create_usdt" }) },
        ],
        [
          { text: "انشاء عرض شام كاش دولار", callback_data: JSON.stringify({ type: callbackTypes.ways, data: "create_sham" }) },
        ],
        [
          { text: "تصفح عروض", callback_data: JSON.stringify({ type: callbackTypes.ways, data: "browse" }) },
        ],


        [
          { text: "ادارة عروضي", callback_data: JSON.stringify({ type: callbackTypes.ways, data: "manage" }) },
          { text: "تنبيهات الأسعار", callback_data: JSON.stringify({ type: callbackTypes.ways, data: "alarms" }) },
        ],
        [
          { text: "لوحتي الشخصية", callback_data: JSON.stringify({ type: callbackTypes.ways, data: "profile" }) },
          { text: "معلومات ودعم | USDTSY", callback_data: JSON.stringify({ type: callbackTypes.ways, data: "info" }) },
        ],

        ]
      }
    });
}



// ملخص العرض:

// 🔴 النوع: بيع USDT
// 💲 السعر: 12400.0
// 📊 الكمية: من 22.0 إلى 22.0 USDT
// 💳 طرق الدفع: سيرياتيل كاش

// هل تريد تأكيد العرض؟