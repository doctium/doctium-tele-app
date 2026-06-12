/**
 * Server-side notification message catalog (Phase 2 of multi-language).
 *
 * Patient-facing notifications (in-app + push + email + SMS) are sent in the
 * recipient's `User.preferredLanguage`. Call sites pass a stable `key` + `params`
 * instead of a hardcoded English string; the NotificationsService resolves the
 * recipient's language and renders the title/message from this catalog.
 *
 * Codes match the patient app catalog (en | pcm | ha | yo | ig). Unknown
 * languages and missing keys fall back to English. Doctor notifications stay in
 * English for now (doctors have no single preferred language).
 *
 * Translations for pcm/ha/yo/ig are AI-generated — flag for native review.
 * `{{param}}` placeholders are interpolated; their values are data (names, money,
 * already-formatted) and are NOT translated.
 */
export type LocalizedMessage = { title: string; message: string };
type CatalogEntry = Record<string, LocalizedMessage>; // locale -> message

export const NOTIFICATION_STRINGS: Record<string, CatalogEntry> = {
  "wallet.topup": {
    en: {
      title: "Your wallet has a new balance",
      message:
        "{{amount}} was added to your Doctium wallet. New balance: {{balance}}.",
    },
    pcm: {
      title: "Your wallet get new balance",
      message:
        "{{amount}} enter your Doctium wallet. New balance na {{balance}}.",
    },
    ha: {
      title: "Walat ɗinka yana da sabon ma'auni",
      message:
        "An ƙara {{amount}} a cikin walat ɗin Doctium ɗinka. Sabon ma'auni: {{balance}}.",
    },
    yo: {
      title: "Àpamọ́wọ́ rẹ ní ìyókù tuntun",
      message:
        "{{amount}} ni a fi kún àpamọ́wọ́ Doctium rẹ. Ìyókù tuntun: {{balance}}.",
    },
    ig: {
      title: "Obere akpa gị nwere ego ọhụrụ",
      message:
        "Etinyere {{amount}} n'obere akpa Doctium gị. Ego fọdụrụ ọhụrụ: {{balance}}.",
    },
  },
  "account.blocked": {
    en: {
      title: "Account turned off",
      message:
        "Your Doctium account has been temporarily turned off. Contact Doctium support for more information.",
    },
    pcm: {
      title: "Account don off",
      message:
        "Dem don off your Doctium account small time. Contact Doctium support make you know wetin dey happen.",
    },
    ha: {
      title: "An kashe asusu",
      message:
        "An kashe asusun Doctium ɗinka na ɗan lokaci. Tuntuɓi tallafin Doctium don ƙarin bayani.",
    },
    yo: {
      title: "A pa àkáǹtì",
      message:
        "A ti pa àkáǹtì Doctium rẹ fún ìgbà díẹ̀. Kàn sí àtìlẹ́yìn Doctium fún àlàyé síwájú síi.",
    },
    ig: {
      title: "Agbanyụrụ akaụntụ",
      message:
        "Agbanyụọla akaụntụ Doctium gị nwa oge. Kpọtụrụ nkwado Doctium maka ozi ndị ọzọ.",
    },
  },
  "appointment.reminder": {
    en: {
      title: "Appointment in {{minutes}} minutes",
      message:
        "Your appointment with {{doctor}} starts in {{minutes}} minutes.",
    },
    pcm: {
      title: "Appointment go start in {{minutes}} minutes",
      message:
        "Your appointment with {{doctor}} go start in {{minutes}} minutes.",
    },
    ha: {
      title: "Alkawari cikin minti {{minutes}}",
      message: "Alkawarinka da {{doctor}} zai fara cikin minti {{minutes}}.",
    },
    yo: {
      title: "Ìpàdé ní ìṣẹ́jú {{minutes}}",
      message: "Ìpàdé rẹ pẹ̀lú {{doctor}} yóò bẹ̀rẹ̀ ní ìṣẹ́jú {{minutes}}.",
    },
    ig: {
      title: "Oge nzukọ n'ime nkeji {{minutes}}",
      message: "Oge nzukọ gị na {{doctor}} ga-amalite n'ime nkeji {{minutes}}.",
    },
  },
  "referral.received": {
    en: {
      title: "You've been referred to a specialist",
      message:
        "{{doctor}} has referred you to {{specialty}}. Tap to view the referral and book your appointment.",
    },
    pcm: {
      title: "Dem don refer you to specialist",
      message:
        "{{doctor}} don refer you to {{specialty}}. Tap to see the referral and book your appointment.",
    },
    ha: {
      title: "An tura ka zuwa gwani",
      message:
        "{{doctor}} ya tura ka zuwa {{specialty}}. Danna don ka ga turawar ka kuma yi alkawari.",
    },
    yo: {
      title: "A ti tọ́ ọ sí ọ̀mọ̀ràn",
      message:
        "{{doctor}} ti tọ́ ọ sí {{specialty}}. Tẹ̀ láti wo ìtọ́kasí náà kí o sì ṣe ìpàdé rẹ.",
    },
    ig: {
      title: "Eziputaala gị na ọkachamara",
      message:
        "{{doctor}} ezigaala gị na {{specialty}}. Pịa iji hụ nnyefe ahụ wee debe oge nzukọ gị.",
    },
  },
  "referral.accepted": {
    en: {
      title: "Your specialist is ready for you",
      message:
        "{{doctor}} has accepted your referral. Tap to book your appointment.",
    },
    pcm: {
      title: "Your specialist ready for you",
      message:
        "{{doctor}} don accept your referral. Tap to book your appointment.",
    },
    ha: {
      title: "Gwaninka yana shirye don ka",
      message: "{{doctor}} ya karɓi turawar ka. Danna don ka yi alkawari.",
    },
    yo: {
      title: "Ọ̀mọ̀ràn rẹ ti ṣetán fún ọ",
      message: "{{doctor}} ti gba ìtọ́kasí rẹ. Tẹ̀ láti ṣe ìpàdé rẹ.",
    },
    ig: {
      title: "Ọkachamara gị adịla njikere maka gị",
      message: "{{doctor}} anabatala nnyefe gị. Pịa iji debe oge nzukọ gị.",
    },
  },
  "refill.approved": {
    en: {
      title: "Refill approved",
      message: "Your doctor approved your refill request.",
    },
    pcm: {
      title: "Refill approved",
      message: "Your doctor don approve your refill request.",
    },
    ha: {
      title: "An amince da sake cikawa",
      message: "Likitanka ya amince da buƙatar sake cika maganinka.",
    },
    yo: {
      title: "A fọwọ́ sí àtúnkún",
      message: "Dókítà rẹ fọwọ́ sí ìbéèrè àtúnkún òògùn rẹ.",
    },
    ig: {
      title: "Akwadoro mmegharị ọgwụ",
      message: "Dọkịta gị akwadoola arịrịọ mmegharị ọgwụ gị.",
    },
  },
  "refill.declined": {
    en: {
      title: "Refill declined",
      message: "Your doctor declined your refill request.{{note}}",
    },
    pcm: {
      title: "Refill declined",
      message: "Your doctor no approve your refill request.{{note}}",
    },
    ha: {
      title: "An ƙi sake cikawa",
      message: "Likitanka ya ƙi buƙatar sake cika maganinka.{{note}}",
    },
    yo: {
      title: "A kọ àtúnkún",
      message: "Dókítà rẹ kọ ìbéèrè àtúnkún òògùn rẹ.{{note}}",
    },
    ig: {
      title: "Ajụrụ mmegharị ọgwụ",
      message: "Dọkịta gị jụrụ arịrịọ mmegharị ọgwụ gị.{{note}}",
    },
  },
  "satisfaction.survey": {
    en: {
      title: "How was your visit?",
      message:
        "Got a minute? Tell us how your consultation with {{doctor}} went — your feedback keeps care quality high.",
    },
    pcm: {
      title: "How your visit be?",
      message:
        "You get one minute? Tell us how your consultation with {{doctor}} go — your feedback dey help care quality.",
    },
    ha: {
      title: "Yaya ziyararka ta kasance?",
      message:
        "Kana da minti ɗaya? Gaya mana yadda shawararka da {{doctor}} ta kasance — ra'ayinka yana sa ingancin kulawa ya ci gaba.",
    },
    yo: {
      title: "Báwo ni ìbẹ̀wò rẹ ṣe rí?",
      message:
        "Ṣé o ní ìṣẹ́jú kan? Sọ fún wa bí ìjíròrò rẹ pẹ̀lú {{doctor}} ṣe rí — èsì rẹ ń mú kí ìtọ́jú dára.",
    },
    ig: {
      title: "Kedu ka nleta gị siri dị?",
      message:
        "Ị nwere otu nkeji? Gwa anyị otú ndụmọdụ gị na {{doctor}} si gaa — nzaghachi gị na-eme ka ịdị mma nlekọta dịgide.",
    },
  },
  "referral.bonus": {
    en: {
      title: "You've earned a referral bonus 🎉",
      message:
        "{{amount}} was added to your wallet — {{friend}} signed up with your code and booked their first consultation. New balance: {{balance}}.",
    },
    pcm: {
      title: "You don earn referral bonus 🎉",
      message:
        "{{amount}} enter your wallet — {{friend}} sign up with your code and book their first consultation. New balance: {{balance}}.",
    },
    ha: {
      title: "Ka sami ladan turawa 🎉",
      message:
        "An ƙara {{amount}} a cikin walat ɗinka — {{friend}} ya yi rajista da lambar ka kuma ya yi shawararsa ta farko. Sabon ma'auni: {{balance}}.",
    },
    yo: {
      title: "O ti gba èrè ìtọ́kasí 🎉",
      message:
        "{{amount}} ni a fi kún àpamọ́wọ́ rẹ — {{friend}} forúkọsílẹ̀ pẹ̀lú kóòdù rẹ ó sì ṣe ìjíròrò àkọ́kọ́ rẹ̀. Ìyókù tuntun: {{balance}}.",
    },
    ig: {
      title: "Ị nwetala ego nnyefe 🎉",
      message:
        "Etinyere {{amount}} n'obere akpa gị — {{friend}} debanyere aha site na koodu gị wee debe ndụmọdụ mbụ ya. Ego fọdụrụ ọhụrụ: {{balance}}.",
    },
  },
  "care.vitalAlert": {
    en: {
      title: "Please check in with a doctor",
      message:
        "Your {{category}} reading of {{reading}} needs attention. Book a consultation now — if you feel unwell, seek urgent care immediately.",
    },
    pcm: {
      title: "Abeg check in with doctor",
      message:
        "Your {{category}} reading of {{reading}} need attention. Book consultation now — if you no dey feel fine, find urgent care sharp-sharp.",
    },
    ha: {
      title: "Da fatan ka duba da likita",
      message:
        "Karatun {{category}} ɗinka na {{reading}} yana buƙatar kulawa. Yi shawara yanzu — idan ba ka jin daɗi, nemi kulawa cikin gaggawa nan da nan.",
    },
    yo: {
      title: "Jọ̀wọ́ bá dókítà sọ̀rọ̀",
      message:
        "Ìkàwé {{category}} rẹ tí ó jẹ́ {{reading}} nílò àfiyèsí. Ṣe ìjíròrò báyìí — bí ara rẹ kò bá yá, wá ìtọ́jú kíákíá lẹ́sẹ̀kẹsẹ̀.",
    },
    ig: {
      title: "Biko soro dọkịta kparịta",
      message:
        "Ọgụgụ {{category}} gị nke {{reading}} chọrọ nlebara anya. Debe ndụmọdụ ugbu a — ọ bụrụ na ahụ adịghị gị mma, chọọ nlekọta ngwa ngwa ozugbo.",
    },
  },
  "care.doseUpdated": {
    en: {
      title: "Your medication plan was updated",
      message:
        "Your care lead set your {{program}} hydroxyurea dose to {{dose}} mg per day. Take it exactly as prescribed, and log your blood tests when you get them.",
    },
    pcm: {
      title: "Dem don update your medicine plan",
      message:
        "Your care lead don set your {{program}} hydroxyurea dose to {{dose}} mg every day. Take am exactly as dem prescribe am, and enter your blood test results when you get dem.",
    },
    ha: {
      title: "An sabunta tsarin maganinka",
      message:
        "Likitan kulawarka ya saita adadin hydroxyurea na {{program}} zuwa {{dose}} mg a rana. Ka sha shi daidai yadda aka rubuta, ka kuma shigar da sakamakon gwajin jininka idan ka samu.",
    },
    yo: {
      title: "A ti ṣe àtúnṣe ètò òògùn rẹ",
      message:
        "Olùtọ́jú rẹ ti ṣètò ìwọ̀n hydroxyurea {{program}} rẹ sí {{dose}} mg lójoojúmọ́. Lò ó gẹ́gẹ́ bí a ṣe kọ ọ́, kí o sì ṣe àkọsílẹ̀ àbájáde àyẹ̀wò ẹ̀jẹ̀ rẹ nígbà tí o bá gbà wọ́n.",
    },
    ig: {
      title: "Emelitela atụmatụ ọgwụ gị",
      message:
        "Onye nlekọta gị edobela ọgwụ hydroxyurea nke {{program}} gị na {{dose}} mg kwa ụbọchị. Ṅụọ ya kpọmkwem ka e dere ya, ma debanye nsonaazụ nyocha ọbara gị mgbe ị nwetara ha.",
    },
  },
  "care.labFlagged": {
    en: {
      title: "Your lab results need your doctor's attention",
      message:
        "Some of your {{program}} blood results are outside the safe range, and your care lead has been alerted. Don't change your medication dose yourself — your doctor will advise you. If you feel unwell, seek care now.",
    },
    pcm: {
      title: "Your lab results need your doctor attention",
      message:
        "Some of your {{program}} blood results no dey inside safe range, and we don tell your care lead. No change your medicine dose by yourself — your doctor go advise you. If you no dey feel fine, find care now.",
    },
    ha: {
      title: "Sakamakon gwajinka na buƙatar kulawar likitanka",
      message:
        "Wasu daga cikin sakamakon gwajin jinin {{program}} ɗinka sun fita daga iyakar aminci, kuma an sanar da likitan kulawarka. Kada ka canza adadin maganinka da kanka — likitanka zai ba ka shawara. Idan ba ka jin daɗi, nemi kulawa yanzu.",
    },
    yo: {
      title: "Àbájáde àyẹ̀wò rẹ nílò àfiyèsí dókítà rẹ",
      message:
        "Díẹ̀ lára àbájáde àyẹ̀wò ẹ̀jẹ̀ {{program}} rẹ ti jáde kúrò ní ibi ààbò, a sì ti sọ fún olùtọ́jú rẹ. Má ṣe yí ìwọ̀n òògùn rẹ padà fúnra rẹ — dókítà rẹ yóò gbà ọ́ nímọ̀ràn. Bí ara rẹ kò bá yá, wá ìtọ́jú báyìí.",
    },
    ig: {
      title: "Nsonaazụ nyocha gị chọrọ nlebara anya dọkịta gị",
      message:
        "Ụfọdụ nsonaazụ nyocha ọbara {{program}} gị apụọla n'ókè nchekwa, agwala onye nlekọta gị. Agbanwela ọgwụ gị n'onwe gị — dọkịta gị ga-adụ gị ọdụ. Ọ bụrụ na ahụ adịghị gị mma, chọọ nlekọta ugbu a.",
    },
  },
  "care.labDue": {
    en: {
      title: "Time for your blood test",
      message:
        "It's been over 8 weeks since your last blood count for {{program}}. Hydroxyurea needs regular CBC monitoring — please get one done and log the results in the app.",
    },
    pcm: {
      title: "Time don reach for your blood test",
      message:
        "E don pass 8 weeks since your last blood count for {{program}}. Hydroxyurea need regular CBC check — abeg go do one and enter di results for di app.",
    },
    ha: {
      title: "Lokacin gwajin jininka ya yi",
      message:
        "Fiye da makonni 8 ke nan tun gwajin jininka na ƙarshe na {{program}}. Hydroxyurea na buƙatar bibiyar CBC akai-akai — da fatan ka yi gwaji ka kuma shigar da sakamakon a manhajar.",
    },
    yo: {
      title: "Àkókò àyẹ̀wò ẹ̀jẹ̀ rẹ ti tó",
      message:
        "Ó ti ju ọ̀sẹ̀ 8 lọ láti ìgbà àyẹ̀wò ẹ̀jẹ̀ rẹ tó kẹ́yìn fún {{program}}. Hydroxyurea nílò àbójútó CBC déédéé — jọ̀wọ́ ṣe ọ̀kan kí o sì ṣe àkọsílẹ̀ àbájáde nínú àpù.",
    },
    ig: {
      title: "Oge nyocha ọbara gị eruola",
      message:
        "Ọ gafeela izu 8 kemgbe nyocha ọbara gị ikpeazụ maka {{program}}. Hydroxyurea chọrọ nlekota CBC mgbe niile — biko mee otu ma debanye nsonaazụ ya na ngwa ahụ.",
    },
  },
  "care.riskHigh": {
    en: {
      title: "Your crisis risk is higher today",
      message:
        "Signals from your {{program}} tracking suggest a higher crisis risk right now. Drink water steadily, keep warm, rest, and take your medications. If pain starts, or you have chest pain or trouble breathing, seek care immediately.",
    },
    pcm: {
      title: "Your crisis risk high today",
      message:
        "Wetin we dey see from your {{program}} tracking show say your crisis risk dey high now. Dey drink water well well, keep your body warm, rest, and take your medicine. If pain start, or you get chest pain or you no fit breathe well, find care sharp-sharp.",
    },
    ha: {
      title: "Haɗarin rikicinka ya ɗaga yau",
      message:
        "Alamomi daga bibiyar {{program}} ɗinka na nuna haɗarin rikici ya ɗaga yanzu. Ka sha ruwa akai-akai, ka dumama jiki, ka huta, ka kuma sha magungunanka. Idan zafi ya fara, ko kana jin zafin ƙirji ko wahalar numfashi, nemi kulawa nan da nan.",
    },
    yo: {
      title: "Ewu ìṣòro rẹ ga ní òní",
      message:
        "Àmì láti inú ìtọpinpin {{program}} rẹ fi hàn pé ewu ìṣòro ga báyìí. Máa mu omi déédéé, jẹ́ kí ara rẹ gbóná, sinmi, kí o sì lo òògùn rẹ. Bí ìrora bá bẹ̀rẹ̀, tàbí o ní ìrora àyà tàbí ìṣòro mímí, wá ìtọ́jú lẹ́sẹ̀kẹsẹ̀.",
    },
    ig: {
      title: "Ihe egwu nsogbu gị dị elu taa",
      message:
        "Ihe ngosi sitere na nsochi {{program}} gị na-egosi na ihe egwu nsogbu dị elu ugbu a. Na-aṅụ mmiri mgbe niile, mee ka ahụ gị dị ọkụ, zuru ike, ma ṅụọ ọgwụ gị. Ọ bụrụ na ihe mgbu ebido, ma ọ bụ na ị nwere mgbu obi ma ọ bụ nsogbu iku ume, chọọ nlekọta ozugbo.",
    },
  },
  "care.crisisLogged": {
    en: {
      title: "Crisis logged — your care lead has been alerted",
      message:
        "We've alerted your care lead about your {{program}} crisis. If your pain is severe, or you have chest pain, trouble breathing or a high fever, please seek urgent care now.",
    },
    pcm: {
      title: "Crisis don enter — we don tell your care lead",
      message:
        "We don tell your care lead about your {{program}} crisis. If di pain too strong, or you get chest pain, you no fit breathe well or you get high fever, abeg find urgent care sharp-sharp.",
    },
    ha: {
      title: "An rubuta rikicin — an sanar da likitan kulawarka",
      message:
        "Mun sanar da likitan kulawarka game da rikicin {{program}} naka. Idan zafin ya yi tsanani, ko kana jin zafin ƙirji, wahalar numfashi ko zazzaɓi mai zafi, da fatan ka nemi kulawar gaggawa yanzu.",
    },
    yo: {
      title: "A ti kọ ìṣòro náà sílẹ̀ — a ti sọ fún olùtọ́jú rẹ",
      message:
        "A ti sọ fún olùtọ́jú rẹ nípa ìṣòro {{program}} rẹ. Bí ìrora bá le gan-an, tàbí o ní ìrora àyà, ìṣòro mímí tàbí ibà gíga, jọ̀wọ́ wá ìtọ́jú kíákíá báyìí.",
    },
    ig: {
      title: "Edebanyela nsogbu ahụ — agwala onye nlekọta gị",
      message:
        "Agwala onye nlekọta gị maka nsogbu {{program}} gị. Ọ bụrụ na ihe mgbu ahụ siri ike, ma ọ bụ na ị nwere mgbu obi, nsogbu iku ume ma ọ bụ ahụ ọkụ dị elu, biko chọọ nlekọta ngwa ngwa ugbu a.",
    },
  },
  "care.doctorSuggestedProgram": {
    en: {
      title: "Your doctor recommends a care program",
      message:
        "{{doctor}} recommends the {{program}} program to help you manage {{condition}}. Open Care programs in the app to learn more and join.",
    },
    pcm: {
      title: "Your doctor recommend care program",
      message:
        "{{doctor}} talk say di {{program}} program fit help you manage {{condition}}. Open Care programs for di app make you learn more and join.",
    },
    ha: {
      title: "Likitanka ya ba da shawarar shirin kulawa",
      message:
        "{{doctor}} ya ba da shawarar shirin {{program}} don taimaka maka sarrafa {{condition}}. Buɗe Care programs a cikin manhajar don ƙarin bayani da shiga.",
    },
    yo: {
      title: "Dókítà rẹ dábàá ètò ìtọ́jú",
      message:
        "{{doctor}} dábàá ètò {{program}} láti ràn ọ́ lọ́wọ́ láti ṣàkóso {{condition}}. Ṣí Care programs nínú àpù láti mọ̀ síi kí o sì darapọ̀.",
    },
    ig: {
      title: "Dọkịta gị tụrụ aro mmemme nlekọta",
      message:
        "{{doctor}} tụrụ aro mmemme {{program}} iji nyere gị aka ijikwa {{condition}}. Mepee Care programs n'ime ngwa ahụ ka ịmatakwu ma sonye.",
    },
  },
  "care.newGoal": {
    en: {
      title: "New goal from your care lead",
      message: "{{goal}}{{due}}. You've got this!",
    },
    pcm: {
      title: "New goal from your care lead",
      message: "{{goal}}{{due}}. You fit do am!",
    },
    ha: {
      title: "Sabon buri daga jagoran kulawarka",
      message: "{{goal}}{{due}}. Za ka iya!",
    },
    yo: {
      title: "Àfojúsùn tuntun láti ọ̀dọ̀ aṣáájú ìtọ́jú rẹ",
      message: "{{goal}}{{due}}. O lè ṣe é!",
    },
    ig: {
      title: "Ebumnuche ọhụrụ site n'aka onye nlekọta gị",
      message: "{{goal}}{{due}}. Ị nwere ike ime ya!",
    },
  },
  "care.goalAchieved": {
    en: {
      title: "Goal achieved 🎉",
      message: "You hit your goal: {{goal}}. Brilliant work — keep it up!",
    },
    pcm: {
      title: "You don reach your goal 🎉",
      message: "You reach your goal: {{goal}}. Well done — continue like that!",
    },
    ha: {
      title: "An cim ma buri 🎉",
      message: "Ka cim ma burinka: {{goal}}. Kyakkyawan aiki — ci gaba haka!",
    },
    yo: {
      title: "A dé àfojúsùn 🎉",
      message: "O dé àfojúsùn rẹ: {{goal}}. Iṣẹ́ àtàtà — máa bá a lọ!",
    },
    ig: {
      title: "Erutela ebumnuche 🎉",
      message: "Ị rutere ebumnuche gị: {{goal}}. Ọrụ magburu onwe ya — nọgide!",
    },
  },
  "care.checkin": {
    en: {
      title: "{{program}} check-in",
      message:
        "Time for your {{program}} check-in — log your readings so your care lead can keep an eye on your progress.",
    },
    pcm: {
      title: "{{program}} check-in",
      message:
        "Na time for your {{program}} check-in — record your readings so your care lead fit dey watch your progress.",
    },
    ha: {
      title: "Shiga {{program}}",
      message:
        "Lokaci ya yi don shigar {{program}} ɗinka — shigar da karatunka domin jagoran kulawarka ya iya kallon ci gaban ka.",
    },
    yo: {
      title: "Ìforúkọsílẹ̀ {{program}}",
      message:
        "Àkókò tó fún ìforúkọsílẹ̀ {{program}} rẹ — kọ àwọn ìkàwé rẹ sílẹ̀ kí aṣáájú ìtọ́jú rẹ lè máa bójú tó ìlọsíwájú rẹ.",
    },
    ig: {
      title: "Nlọ {{program}}",
      message:
        "Oge eruola maka nlọ {{program}} gị — depụta ọgụgụ gị ka onye nlekọta gị nwee ike na-elele ọganihu gị.",
    },
  },
  "care.escalation": {
    en: {
      title: "We haven't heard from you",
      message:
        "It's been a while since your last {{program}} reading. A quick log keeps your care on track — and if you're not feeling well, book a consultation.",
    },
    pcm: {
      title: "We never hear from you",
      message:
        "E don tey since your last {{program}} reading. Quick record dey keep your care on track — and if you no dey feel fine, book consultation.",
    },
    ha: {
      title: "Ba mu ji labarinka ba",
      message:
        "Lokaci ya wuce tun karatun {{program}} ɗinka na ƙarshe. Shigarwa cikin sauri yana sa kulawarka ta kasance kan turba — kuma idan ba ka jin daɗi, yi shawara.",
    },
    yo: {
      title: "A kò gbọ́ tirẹ",
      message:
        "Ó ti pẹ́ láti ìgbà ìkàwé {{program}} rẹ tó kẹ́yìn. Ìkọsílẹ̀ kíákíá ń mú kí ìtọ́jú rẹ wà létòlétò — bí ara rẹ kò bá yá, ṣe ìjíròrò.",
    },
    ig: {
      title: "Anyị anụbeghị olu gị",
      message:
        "Oge agafeela kemgbe ọgụgụ {{program}} gị ikpeazụ. Ndekọ ngwa ngwa na-eme ka nlekọta gị nọrọ n'usoro — ọ bụrụ na ahụ adịghị gị mma, debe ndụmọdụ.",
    },
  },
  "followup.checkin48h": {
    en: {
      title: "How are you feeling?",
      message:
        "It's been a couple of days since your consult with {{doctor}}. How are you feeling? Tap to book a follow-up if you need one.",
    },
    pcm: {
      title: "How your body dey?",
      message:
        "E don reach some days since your consult with {{doctor}}. How your body dey? Tap to book follow-up if you need am.",
    },
    ha: {
      title: "Yaya kake ji?",
      message:
        "Kwana biyu sun wuce tun shawararka da {{doctor}}. Yaya kake ji? Danna don yin alkawarin biyo-baya idan kana buƙata.",
    },
    yo: {
      title: "Báwo ni ara rẹ?",
      message:
        "Ọjọ́ mélòó kan ti kọjá láti ìjíròrò rẹ pẹ̀lú {{doctor}}. Báwo ni ara rẹ? Tẹ̀ láti ṣe ìpàdé àtẹ̀lé bí o bá nílò rẹ̀.",
    },
    ig: {
      title: "Kedu ka ahụ gị dị?",
      message:
        "Ụbọchị ole na ole agafeela kemgbe ndụmọdụ gị na {{doctor}}. Kedu ka ahụ gị dị? Pịa iji debe nleta ọzọ ma ọ bụrụ na ịchọrọ.",
    },
  },
  "followup.checkin7d": {
    en: {
      title: "Checking in on your recovery",
      message:
        "A week on from your consult with {{doctor}} — we hope you're better. Still have symptoms? Book a follow-up any time.",
    },
    pcm: {
      title: "We dey check your recovery",
      message:
        "One week don pass since your consult with {{doctor}} — we hope say you don better. You still get symptoms? Book follow-up any time.",
    },
    ha: {
      title: "Bincika lafiyarka",
      message:
        "Mako ɗaya ya wuce tun shawararka da {{doctor}} — muna fata ka samu sauƙi. Har yanzu kana da alamomi? Yi alkawarin biyo-baya a kowane lokaci.",
    },
    yo: {
      title: "À ń ṣàyẹ̀wò ìmúláradá rẹ",
      message:
        "Ọ̀sẹ̀ kan ti kọjá láti ìjíròrò rẹ pẹ̀lú {{doctor}} — a ń retí pé ara rẹ ti yá. Ṣé o ṣì ní àwọn àmì àìsàn? Ṣe ìpàdé àtẹ̀lé nígbàkigbà.",
    },
    ig: {
      title: "Na-elele mgbake gị",
      message:
        "Otu izu agafeela kemgbe ndụmọdụ gị na {{doctor}} — anyị nwere olileanya na ahụ dịkwuru gị mma. Ị ka nwere ihe mgbaàmà? Debe nleta ọzọ oge ọ bụla.",
    },
  },
  "followup.doctorScheduled": {
    en: {
      title: "Time for your follow-up",
      message:
        "{{doctor}} asked you to come back in for a follow-up{{note}}. Tap to book your appointment.",
    },
    pcm: {
      title: "Na time for your follow-up",
      message:
        "{{doctor}} talk say make you come back for follow-up{{note}}. Tap to book your appointment.",
    },
    ha: {
      title: "Lokacin biyo-bayanka ya yi",
      message:
        "{{doctor}} ya ce ka dawo don biyo-baya{{note}}. Danna don ka yi alkawari.",
    },
    yo: {
      title: "Àkókò ìpàdé àtẹ̀lé rẹ",
      message:
        "{{doctor}} béèrè kí o padà wá fún ìpàdé àtẹ̀lé{{note}}. Tẹ̀ láti ṣe ìpàdé rẹ.",
    },
    ig: {
      title: "Oge eruola maka nleta ọzọ gị",
      message:
        "{{doctor}} gwara gị ka ị lọghachi maka nleta ọzọ{{note}}. Pịa iji debe oge nzukọ gị.",
    },
  },
  "followup.missedRecovery": {
    en: {
      title: "We missed you",
      message:
        "Looks like you missed your appointment with {{doctor}}. No worries — tap to rebook at a time that works for you.",
    },
    pcm: {
      title: "We miss you",
      message:
        "E be like say you miss your appointment with {{doctor}}. No wahala — tap to rebook for time wey go work for you.",
    },
    ha: {
      title: "Mun rasa ka",
      message:
        "Da alama ka rasa alkawarinka da {{doctor}}. Kada ka damu — danna don sake yin alkawari a lokacin da ya dace da kai.",
    },
    yo: {
      title: "A pàdánù rẹ",
      message:
        "Ó dàbí pé o pàdánù ìpàdé rẹ pẹ̀lú {{doctor}}. Má ṣe àníyàn — tẹ̀ láti tún ìpàdé ṣe ní àkókò tó bá ọ mu.",
    },
    ig: {
      title: "Anyị atụfuru gị",
      message:
        "Ọ dị ka ị tụfuru oge nzukọ gị na {{doctor}}. Echegbula onwe gị — pịa iji debeghachi n'oge dabara gị.",
    },
  },
};

const SUPPORTED = ["en", "pcm", "ha", "yo", "ig"];

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    params[k] !== undefined && params[k] !== null ? String(params[k]) : "",
  );
}

/**
 * Render a notification's title/message in the given language.
 * Falls back to English for unknown languages or missing translations, and to
 * the raw key if the message key itself is unknown (so a bug is visible, not silent).
 */
export function translateNotification(
  locale: string | null | undefined,
  key: string,
  params?: Record<string, string | number>,
): LocalizedMessage {
  const entry = NOTIFICATION_STRINGS[key];
  if (!entry) return { title: key, message: "" };
  const lng = locale && SUPPORTED.includes(locale) ? locale : "en";
  const loc = entry[lng] ?? entry.en;
  if (!loc) return { title: key, message: "" };
  return {
    title: interpolate(loc.title, params),
    message: interpolate(loc.message, params),
  };
}
