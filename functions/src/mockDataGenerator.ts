import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Lazily resolved so initializeApp() in index.ts runs first
const getDb = () => admin.firestore();

// ── Nigerian-realistic data pools ──────────────────────────────────────
const FIRST_NAMES_M = [
  "Chinedu", "Emeka", "Obinna", "Tunde", "Adewale", "Femi", "Kunle",
  "Ifeanyi", "Uche", "Olusegun", "Babajide", "Segun", "Damilare",
  "Oluwaseun", "Nnamdi", "Ikenna", "Tobi", "Ade", "Yinka", "Kayode",
  "Chukwuemeka", "Abiodun", "Olamide", "Chijioke", "Bolaji",
];
const FIRST_NAMES_F = [
  "Ngozi", "Amara", "Chidinma", "Funke", "Yewande", "Bukola", "Adeola",
  "Ifeoma", "Oluchi", "Titilayo", "Aisha", "Zainab", "Halima", "Kemi",
  "Bimpe", "Adaobi", "Tolulope", "Folake", "Jumoke", "Chinwe",
  "Nneka", "Chiamaka", "Sade", "Omolara", "Temitope",
];
const LAST_NAMES = [
  "Okafor", "Adeyemi", "Balogun", "Eze", "Ibrahim", "Okonkwo", "Ajayi",
  "Nwachukwu", "Bakare", "Olawale", "Abubakar", "Nwosu", "Ogunleye",
  "Adebayo", "Chukwu", "Ogundipe", "Fashola", "Okoro", "Adekunle",
  "Obi", "Musa", "Mohammed", "Aliyu", "Lawal", "Oni",
];
const NIGERIAN_STATES = [
  "Lagos", "Abuja", "Kano", "Rivers", "Oyo", "Kaduna", "Enugu",
  "Delta", "Anambra", "Imo", "Ogun", "Edo", "Kwara", "Osun", "Ekiti",
];
const CITIES: Record<string, string[]> = {
  Lagos: ["Ikeja", "Victoria Island", "Lekki", "Surulere", "Yaba"],
  Abuja: ["Garki", "Wuse", "Maitama", "Asokoro", "Gwarinpa"],
  Kano: ["Nassarawa", "Fagge", "Tarauni", "Dala", "Gwale"],
  Rivers: ["Port Harcourt", "Obio-Akpor", "Eleme", "Bonny"],
  Oyo: ["Ibadan", "Ogbomosho", "Oyo", "Iseyin"],
  Kaduna: ["Kaduna North", "Kaduna South", "Zaria", "Kafanchan"],
  Enugu: ["Enugu", "Nsukka", "Udi", "Agbani"],
  Delta: ["Warri", "Asaba", "Sapele", "Ughelli"],
  Anambra: ["Awka", "Onitsha", "Nnewi", "Ekwulobia"],
  Imo: ["Owerri", "Orlu", "Okigwe", "Oguta"],
  Ogun: ["Abeokuta South", "Sagamu", "Ijebu Ode", "Ota"],
  Edo: ["Benin City", "Auchi", "Ekpoma", "Uromi"],
  Kwara: ["Ilorin", "Offa", "Omu-Aran"],
  Osun: ["Osogbo", "Ile-Ife", "Ilesa"],
  Ekiti: ["Ado-Ekiti", "Ikere", "Oye"],
};
const STREETS = [
  "Broad Street", "Allen Avenue", "Awolowo Road", "Adeola Odeku",
  "Victoria Crescent", "Herbert Macaulay Way", "Abiola Way",
  "Isale Ebutu", "Commercial Avenue", "Market Road",
  "Bode Thomas Street", "Ahmadu Bello Way", "Yakubu Gowon Road",
];

// Real microfinance/mobile money banks on Anchor
const ANCHOR_BANKS = [
  { name: "CORESTEP MICROFINANCE BANK", nipCode: "090365", id: "16528052138160-anc_bk" },
  { name: "9 PAYMENT SERVICE BANK", nipCode: "120001", id: "16528052169542-anc_bk" },
  { name: "OPAY DIGITAL SERVICES", nipCode: "100004", id: "16528052192340-anc_bk" },
  { name: "PALMPAY", nipCode: "100033", id: "16528052201450-anc_bk" },
  { name: "EYOWO MICROFINANCE BANK", nipCode: "090328", id: "16528052213561-anc_bk" },
  { name: "KUDA MICROFINANCE BANK", nipCode: "090267", id: "16528052224672-anc_bk" },
];
const ISP_ORGS = [
  "MTN NIGERIA Communication limited",
  "Airtel Networks Nigeria",
  "Globacom Limited",
  "Emerging Markets Telecommunication Services",
  "Spectranet International Limited",
];
const TECNO_DEVICES = [
  "TECNO CLA5", "TECNO CI6", "TECNO KG7", "TECNO LH8", "TECNO KI7",
  "INFINIX X6831", "INFINIX X669", "INFINIX HOT12",
];
const SAMSUNG_DEVICES = [
  "Samsung SM-A145F", "Samsung SM-A546B", "Samsung SM-S911B", "Samsung SM-A325F",
];
const IPHONE_DEVICES = ["iPhone14,2", "iPhone15,2", "iPhone13,2", "iPhone12,1"];
const ADMIN_ROUTES = [
  "/", "/users", "/compliance-kyc", "/login-logs", "/blocked-logins",
  "/analytics", "/agents", "/transactions", "/referrals",
  "/communications", "/admins", "/settings", "/activity-logs",
];
const BLOCK_ERRORS = [
  "We have blocked all requests from this device due to unusual activity. Try again later.",
  "Your account has been temporarily locked due to multiple failed login attempts.",
  "Too many failed attempts. Please try again in 30 minutes.",
];
const LOGIN_ERRORS = [
  "Invalid email or password.",
  "Account not found.",
  "Incorrect password. 2 attempts remaining.",
];
const TRANSFER_BANKS = [
  "GTBank", "First Bank Nigeria", "UBA", "Access Bank", "Zenith Bank",
  "9 Payment Service Bank", "Opay", "Palmpay", "Kuda Bank",
  "Stanbic IBTC", "Sterling Bank", "Wema Bank", "Fidelity Bank",
];
const RECIPIENT_NAMES = [
  "Ekundayo Emmanuel", "Chiamaka Obi", "Tunde Fashola", "Ngozi Eze",
  "Ibrahim Musa", "Amara Nwachukwu", "Segun Adeyemi", "Kemi Balogun",
  "Chinedu Okafor", "Funke Ajayi",
];

// ── Helpers ────────────────────────────────────────────────────────────
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const uuid = () =>
  "mock_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ancId = () =>
  `${Date.now()}${randInt(1000, 9999)}-anc_`;

const randPhone = () =>
  `+234${pick(["703", "803", "813", "903", "913", "706", "816", "906"])}${Array.from({ length: 7 }, () => randInt(0, 9)).join("")}`;

const randPhoneLocal = () =>
  `0${pick(["703", "803", "813", "903", "913", "706", "816", "906"])}${Array.from({ length: 7 }, () => randInt(0, 9)).join("")}`;

const randBVN = () =>
  Array.from({ length: 11 }, () => randInt(0, 9)).join("");

const randAccountNumber = () =>
  Array.from({ length: 10 }, () => randInt(0, 9)).join("");

const randEmail = (first: string, last: string) => {
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];
  return `${first.toLowerCase()}${last.toLowerCase()}${randInt(1, 999)}@${pick(domains)}`;
};

const recentISO = (maxHoursAgo: number): string => {
  const ms = Date.now() - randInt(0, maxHoursAgo * 60 * 60 * 1000);
  return new Date(ms).toISOString();
};

const recentMs = (maxHoursAgo: number): number =>
  Date.now() - randInt(0, maxHoursAgo * 60 * 60 * 1000);

function randomIP(): string {
  return `${pick(["41", "102", "105", "154", "197"])}.${randInt(1, 254)}.${randInt(1, 254)}.${randInt(1, 254)}`;
}

function generateUser(): { id: string; data: Record<string, any> } {
  const isFemale = Math.random() > 0.5;
  const firstName = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M);
  const lastName = pick(LAST_NAMES);
  const state = pick(NIGERIAN_STATES);
  const city = pick(CITIES[state] || ["Central"]);
  const dobYear = randInt(1970, 2003);
  const dobMonth = String(randInt(1, 12)).padStart(2, "0");
  const dobDay = String(randInt(1, 28)).padStart(2, "0");
  const dob = `${dobYear}-${dobMonth}-${dobDay}`;
  const email = randEmail(firstName, lastName);
  const phone = randPhone();
  const id = uuid();
  const hasKYC = Math.random() > 0.4;
  const isAgent = Math.random() > 0.85;
  const bank = pick(ANCHOR_BANKS);
  const accountNumber = randAccountNumber();
  const anchorCustomerId = `${ancId()}anc_ind_cst`;
  const anchorAccountId = `${ancId()}anc_acc`;
  const createdAtISO = recentISO(90 * 24);

  const data: Record<string, any> = {
    mock: true,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email,
    phone,
    dob,
    gender: isFemale ? "Female" : "Male",
    address1: `${randInt(1, 200)} ${pick(STREETS)}, ${city}`,
    state: state.toLowerCase(),
    country: "Nigeria",
    postalCode: String(randInt(100000, 999999)),
  };

  if (hasKYC) {
    data.kycStatus = pick(["APPROVED", "APPROVED", "PENDING"]);
    data.bvn = randBVN();
    data.dateOfBirth = dob;
    data.address = {
      street: `${randInt(1, 200)} ${pick(STREETS)}`,
      city,
      state,
      postalCode: String(randInt(100000, 999999)),
      country: "NG",
    };
    data.getAnchorData = {
      tier: pick([1, 2, 3]),
      virtualAccount: {
        data: {
          type: "DepositAccount",
          id: anchorAccountId,
          relationships: {
            virtualNubans: { data: [] },
            customer: {
              data: { type: "IndividualCustomer", id: anchorCustomerId },
            },
            subAccounts: { data: [] },
            accountNumbers: { data: [] },
            program: {
              data: {
                type: "Program",
                id: "17333124341925436551-anc_prg",
              },
            },
          },
          attributes: {
            type: "SAVINGS",
            bank: {
              name: bank.name,
              nipCode: bank.nipCode,
              cbnCode: "",
              id: bank.id,
            },
            createdAt: createdAtISO,
            currency: "NGN",
            accountNumber: `******${accountNumber.slice(-4)}`,
            status: "ACTIVE",
            frozen: false,
            accountName: `${lastName} ${firstName}`,
          },
        },
      },
      customerCreation: {
        data: {
          type: "IndividualCustomer",
          id: anchorCustomerId,
          relationships: {
            organization: {
              data: { id: "17613015280820-anc_og", type: "Organization" },
            },
            documents: { data: [] },
          },
          attributes: {
            createdAt: createdAtISO,
            address: {
              postalCode: String(randInt(100000, 999999)),
              city,
              addressLine_1: `${randInt(1, 200)} ${pick(STREETS)}`,
              country: "NG",
              state,
            },
            email,
            phoneNumber: randPhoneLocal(),
            fullName: {
              firstName,
              lastName,
              middleName: null,
              maidenName: null,
            },
            verification: { status: "unverified" },
            status: "ACTIVE",
            soleProprietor: false,
          },
        },
      },
      upgradeKyc: {
        data: {
          id: "0",
          attributes: {
            events: [
              {
                type: "customer.identification.approved",
                description: "Generated when a Customer Kyc is approved.",
              },
              {
                type: "customer.identification.error",
                description: "Generated when a Customer Kyc fails due to an error.",
              },
              {
                type: "customer.identification.rejected",
                description: "Generated when a Customer Kyc is rejected.",
              },
            ],
            message:
              "KYC initiated successfully. Kindly listen for the respective webhook events",
          },
        },
      },
    };
  } else {
    data.kycStatus = "NOT_SUBMITTED";
  }

  if (isAgent) {
    data.role = "agent";
  }

  return { id, data };
}

function generateTransaction(
  userId: string,
  receiverUserId?: string,
): { id: string; data: Record<string, any> } {
  const type = pick([
    "deposit", "deposit",
    "transfer", "transfer", "transfer",
    "withdrawal",
    "airtime", "wifi",
  ]);
  const status = pick(["success", "success", "success", "failed", "pending"]);
  const amount = type === "deposit"
    ? randInt(1000, 50000)
    : type === "transfer" || type === "withdrawal"
      ? randInt(200, 30000)
      : randInt(50, 5000);
  const timestamp = recentISO(30 * 24);
  const reference = `${Date.now()}${randInt(1000, 9999)}-anc_trsf`;
  const bank = pick(TRANSFER_BANKS);
  const bankCode = `${ancId()}anc_bk`;

  const base: Record<string, any> = {
    mock: true,
    type,
    amount,
    status,
    currency: "NGN",
    timestamp,
    reference,
    userId,
    reason: "",
  };

  if (type === "transfer") {
    base.recipientName = pick(RECIPIENT_NAMES);
    base.bankName = bank;
    base.bank_code = bankCode;
    base.account_number = randAccountNumber();
    if (receiverUserId) base.receiverId = receiverUserId;
    base.api_response = {
      data: {
        type: "NIP_TRANSFER",
        id: reference,
        relationships: {
          account: { data: { type: "DepositAccount", id: `${ancId()}anc_acc` } },
          anchorFee: { data: { type: "OrganizationFee", id: `${ancId()}anc_ogf` } },
          program: { data: { id: "17333124341925436551-anc_prg", type: "Program" } },
          customer: { data: { type: "IndividualCustomer", id: `${ancId()}anc_ind_cst` } },
          counterParty: { data: { id: `${ancId()}anc_cp`, type: "CounterParty" } },
        },
        attributes: {
          createdAt: timestamp,
          sessionId: String(Date.now()),
          amount: amount * 100,
          reference: String(Date.now()),
          currency: "NGN",
          status: "SUCCESSFUL",
        },
      },
    };
  } else if (type === "deposit") {
    base.senderName = pick(RECIPIENT_NAMES);
    base.bankName = bank;
    base.bank_code = "unknown";
    base.account_number = "";
    if (receiverUserId) base.senderId = receiverUserId;
    base.api_response = {
      data: {
        type: "BANK_TRANSFER",
        id: `${ancId()}anc_inb_trsf`,
        relationships: {
          customer: { data: { id: `${ancId()}anc_ind_cst`, type: "IndividualCustomer" } },
          counterParty: { data: { id: "external-cp", type: "CounterParty" } },
          program: { data: { type: "Program", id: "Default" } },
          account: { data: { id: `${ancId()}anc_acc`, type: "DepositAccount" } },
        },
        attributes: {
          createdAt: timestamp,
          reference: String(Date.now()),
          amount: amount * 100,
          status: "SUCCESSFUL",
          currency: "NGN",
        },
      },
    };
  } else if (type === "withdrawal") {
    base.bankName = bank;
    base.bank_code = bankCode;
    base.account_number = randAccountNumber();
    base.recipientName = pick(RECIPIENT_NAMES);
  } else {
    base.senderId = userId;
    base.receiverId = userId;
    base.purpose = "";
  }

  return { id: uuid(), data: base };
}

function generateLoginLog(email: string): { id: string; data: Record<string, any> } {
  const success = Math.random() > 0.2;
  const state = pick(NIGERIAN_STATES);
  const city = pick(CITIES[state] || ["Lagos"]);
  const ip = randomIP();
  const isBlocked = !success && Math.random() > 0.6;

  const networkType = pick([
    "[ConnectivityResult.wifi]",
    "[ConnectivityResult.mobile]",
    "[ConnectivityResult.wifi]",
    "[ConnectivityResult.wifi]",
    "[ConnectivityResult.mobile]",
  ]);

  const deviceProfile = pick([
    { device: pick(TECNO_DEVICES), manufacturer: pick(["TECNO", "INFINIX"]), os: `Android ${randInt(12, 15)}` },
    { device: pick(SAMSUNG_DEVICES), manufacturer: "SAMSUNG", os: `Android ${randInt(13, 15)}` },
    { device: pick(IPHONE_DEVICES), manufacturer: "APPLE", os: `iOS ${randInt(15, 17)}.${randInt(0, 6)}` },
  ]);

  return {
    id: uuid(),
    data: {
      mock: true,
      email,
      appType: "user",
      success,
      errorMessage: success ? null : isBlocked ? pick(BLOCK_ERRORS) : pick(LOGIN_ERRORS),
      ip,
      networkType,
      timestamp: recentISO(14 * 24),
      userAgent: "Flutter App",
      deviceInfo: {
        device: deviceProfile.device,
        manufacturer: deviceProfile.manufacturer,
        os: deviceProfile.os,
      },
      location: {
        city,
        region: state,
        country: "Nigeria",
        org: pick(ISP_ORGS),
        ip,
      },
    },
  };
}

function generateBlockedLogin(email: string): { id: string; data: Record<string, any> } {
  const ip = randomIP();
  const state = pick(NIGERIAN_STATES);
  const city = pick(CITIES[state] || ["Lagos"]);

  return {
    id: uuid(),
    data: {
      mock: true,
      email,
      appType: "user",
      success: false,
      errorMessage: pick(BLOCK_ERRORS),
      ip,
      networkType: "[ConnectivityResult.mobile]",
      timestamp: recentISO(7 * 24),
      userAgent: "Flutter App",
      deviceInfo: {
        device: pick(TECNO_DEVICES),
        manufacturer: "TECNO",
        os: `Android ${randInt(12, 15)}`,
      },
      location: {
        city,
        region: state,
        country: "Nigeria",
        org: pick(ISP_ORGS),
        ip,
      },
    },
  };
}

function generateActivityLog(
  adminId: string,
  adminEmail: string,
  adminName: string,
): { id: string; data: Record<string, any> } {
  const route = pick(ADMIN_ROUTES);
  const startTime = recentMs(48);
  const duration = randInt(3000, 90000);
  const endTime = startTime + duration;

  return {
    id: uuid(),
    data: {
      mock: true,
      adminId,
      adminEmail,
      adminName,
      route,
      action: "page_view",
      startTime,
      endTime,
      duration,
      createdAt: startTime,
      updatedAt: new Date(endTime).toISOString(),
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randInt(140, 145)}.0.0.0 Safari/537.36`,
      ipAddress: randomIP(),
    },
  };
}

function generateReferral(
  referrerUid: string,
  referrerName: string,
  referredUid: string,
  referredName: string,
): { id: string; data: Record<string, any> } {
  return {
    id: uuid(),
    data: {
      mock: true,
      referrerUid,
      referrerName,
      referredUid,
      referredName,
      createdAt: admin.firestore.Timestamp.fromMillis(recentMs(60 * 24)),
    },
  };
}

function generateBusiness(
  ownerId: string,
  ownerName: string,
  ownerEmail: string,
): { id: string; data: Record<string, any> } {
  const bizNames = [
    "Eze Global Logistics", "Balogun Textiles Ltd", "Ajayi Tech Solutions",
    "Nwachukwu Farms", "Adeyemi Motors", "Okafor Provisions",
    "Ibrahim Commodities", "Lagos Digital Hub", "Kano Trade Connect",
    "Enugu Fresh Produce", "Abuja Realty Corp",
  ];
  const state = pick(NIGERIAN_STATES);
  const city = pick(CITIES[state] || ["Central"]);
  const bank = pick(ANCHOR_BANKS);
  const accountNumber = randAccountNumber();
  const anchorAccountId = `${ancId()}anc_acc`;
  const anchorCustomerId = `${ancId()}anc_ind_cst`;
  const createdAtISO = recentISO(90 * 24);

  return {
    id: uuid(),
    data: {
      mock: true,
      ownerId,
      ownerName,
      business_data: {
        name: pick(bizNames),
        desc: "A growing business powered by PadiPay",
        bizAddress: `${randInt(1, 100)} ${pick(STREETS)}, ${city}`,
        industry: pick(["Retail", "Agriculture", "Technology", "Logistics", "Food & Beverage"]),
        regType: pick(["LLC", "Sole Proprietor", "Partnership"]),
        regDate: `${randInt(2015, 2025)}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`,
        regCity: city,
        regState: state,
      },
      contact_data: {
        email: ownerEmail,
        phone: randPhone(),
        city,
        state,
        postal: String(randInt(100000, 999999)),
      },
      getAnchorData: {
        virtualAccount: {
          data: {
            type: "DepositAccount",
            id: anchorAccountId,
            relationships: {
              virtualNubans: { data: [] },
              customer: { data: { type: "IndividualCustomer", id: anchorCustomerId } },
              subAccounts: { data: [] },
              accountNumbers: { data: [] },
              program: { data: { type: "Program", id: "17333124341925436551-anc_prg" } },
            },
            attributes: {
              type: "SAVINGS",
              bank: { name: bank.name, nipCode: bank.nipCode, cbnCode: "", id: bank.id },
              createdAt: createdAtISO,
              currency: "NGN",
              accountNumber: `******${accountNumber.slice(-4)}`,
              status: "ACTIVE",
              frozen: false,
              accountName: ownerName,
            },
          },
        },
      },
      status: pick(["active", "active", "inactive"]),
    },
  };
}

// ── Main generation orchestrator ───────────────────────────────────────

export interface GenerationConfig {
  users: number;
  transactionsPerUser: number;
  loginLogsPerUser: number;
  blockedLogins: number;
  activityLogs: number;
  businesses: number;
  referralChainLength: number;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
}

const DEFAULT_CONFIG: GenerationConfig = {
  users: 8,
  transactionsPerUser: 4,
  loginLogsPerUser: 3,
  blockedLogins: 3,
  activityLogs: 15,
  businesses: 3,
  referralChainLength: 4,
  adminId: "2fpfXRcmUtULTejMnuqMHImV5xC2",
  adminEmail: "admin@padipay.co",
  adminName: "PadiPay Admin",
};

export async function generateMockData(
  config: Partial<GenerationConfig> = {},
): Promise<{ created: Record<string, number> }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const counts: Record<string, number> = {};
  let batch = getDb().batch();
  let ops = 0;
  const MAX_BATCH = 450;

  const flushBatch = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = getDb().batch();
      ops = 0;
    }
  };

  const addDoc = async (col: string, id: string, data: Record<string, any>) => {
    const ref = getDb().collection(col).doc(id);
    batch.set(ref, data);
    ops++;
    counts[col] = (counts[col] || 0) + 1;
    if (ops >= MAX_BATCH) await flushBatch();
  };

  // 1. Users
  const mockUsers: { id: string; data: Record<string, any> }[] = [];
  for (let i = 0; i < cfg.users; i++) {
    const user = generateUser();
    mockUsers.push(user);
    await addDoc("users", user.id, user.data);
  }

  // 2. Referral chains
  for (let i = 0; i < Math.min(cfg.referralChainLength, mockUsers.length - 1); i++) {
    const referrer = mockUsers[i];
    const referred = mockUsers[i + 1];
    if (!referrer || !referred) break;
    const referral = generateReferral(
      referrer.id, referrer.data.fullName,
      referred.id, referred.data.fullName,
    );
    await addDoc("referrals", referral.id, referral.data);
  }

  // 3. Transactions
  for (let i = 0; i < mockUsers.length; i++) {
    const user = mockUsers[i];
    const txCount = randInt(1, cfg.transactionsPerUser);
    for (let j = 0; j < txCount; j++) {
      const otherUser = mockUsers[(i + 1) % mockUsers.length];
      const tx = generateTransaction(user.id, otherUser?.id);
      await addDoc("transactions", tx.id, tx.data);
    }
  }

  // 4. Login logs
  for (const user of mockUsers) {
    const logCount = randInt(1, cfg.loginLogsPerUser);
    for (let j = 0; j < logCount; j++) {
      const log = generateLoginLog(user.data.email);
      await addDoc("loginLogs", log.id, log.data);
    }
  }

  // 5. Blocked logins
  for (const user of mockUsers.slice(0, cfg.blockedLogins)) {
    const blocked = generateBlockedLogin(user.data.email);
    await addDoc("blockedLogins", blocked.id, blocked.data);
  }

  // 6. Activity logs
  const adminId = cfg.adminId ?? DEFAULT_CONFIG.adminId!;
  const adminEmail = cfg.adminEmail ?? DEFAULT_CONFIG.adminEmail!;
  const adminName = cfg.adminName ?? DEFAULT_CONFIG.adminName!;
  for (let i = 0; i < cfg.activityLogs; i++) {
    const log = generateActivityLog(adminId, adminEmail, adminName);
    await addDoc("activityLogs", log.id, log.data);
  }

  // 7. Businesses
  for (const owner of mockUsers.slice(0, cfg.businesses)) {
    const biz = generateBusiness(owner.id, owner.data.fullName, owner.data.email);
    await addDoc("businesses", biz.id, biz.data);
  }

  await flushBatch();
  logger.info("Mock data generation complete", counts);
  return { created: counts };
}

export async function cleanupMockData(): Promise<{ deleted: Record<string, number> }> {
  const collections = [
    "users", "transactions", "loginLogs", "blockedLogins",
    "activityLogs", "referrals", "businesses",
  ];
  const deleted: Record<string, number> = {};

  for (const col of collections) {
    const snapshot = await getDb().collection(col).where("mock", "==", true).get();
    if (snapshot.empty) continue;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const writeBatch = getDb().batch();
      docs.slice(i, i + 450).forEach((d) => writeBatch.delete(d.ref));
      await writeBatch.commit();
    }
    deleted[col] = docs.length;
  }

  logger.info("Mock data cleanup complete", deleted);
  return { deleted };
}
