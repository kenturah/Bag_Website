"use strict";
/* SITE SETTINGS. Everything you must fill in before launch lives in this file. */
var CONFIG = {
  // TODO: choose the real business name. It appears in the header, footer,
  // page titles, the About/Terms pages and the WhatsApp messages.
  brandName: "ToteNest",

  // TODO: the real business WhatsApp number: digits only, with country code (e.g. 2348012345678).
  whatsappNumber: "2348075566140",

  // TODO: the real business bank account. It must match the registered business name.
  bank: {
    accountName: "ToteNest Store",
    accountNumber: "0614777687",
    bankName: "Guaranty Trust Bank"
  },

  // TODO: a payment link from Paystack, Flutterwave or Opay. Leave "" until it exists.
  // This site cannot take card numbers itself; the link is what actually charges the card.
  cardPaymentLink: "" ,

  // Supabase (the shop database). The publishable key is safe to keep here.
  // NEVER put the secret key or the service_role key in this file.
  supabaseUrl: "https://qmqynfjxcaadreffdxza.supabase.co",
  supabaseKey: "sb_publishable_JmaDD-mIK6c8wwC4QD152Q_J5SzQS4A"
};
