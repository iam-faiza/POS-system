/**
 * Internationalization, Currency exchange rates, and Formatting utilities
 * Base currency: PKR (Pakistani Rupee - ₨)
 */

export const CURRENCIES = {
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', rateToPKR: 1.0 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rateToPKR: 278.50 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rateToPKR: 302.20 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rateToPKR: 354.80 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', rateToPKR: 75.80 },
  SAR: { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', rateToPKR: 74.20 }
};

export const TRANSLATIONS = {
  en: {
    // Navigation
    pos_terminal: 'POS Terminal',
    products: 'Products',
    categories: 'Categories',
    customers: 'Customers',
    sales_history: 'Sales History',
    settings: 'Settings',
    logout: 'Logout',

    // POS Terminal
    search_products: 'Search products by name or SKU...',
    all_categories: 'All Categories',
    cart: 'Current Order',
    cart_empty: 'Cart is empty. Select products to begin.',
    customer_select: 'Customer',
    walk_in_customer: 'Walk-in Customer',
    select_customer: 'Select Customer',
    add_new_customer: 'New Customer',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax (5%)',
    total_due: 'Total Due',
    payment_method: 'Payment Method',
    cash: 'Cash',
    card: 'Card',
    card_type: 'Card Type',
    cardholder_name: 'Cardholder Name',
    last4_digits: 'Last 4 Digits',
    auth_ref: 'Auth Reference',
    pay_and_print: 'Process Payment & Print',
    processing: 'Processing...',
    sale_successful: 'Sale Successful!',
    new_sale: 'New Sale',
    print_receipt: 'Print Receipt',

    // Products
    products_and_inventory: 'Products & Inventory',
    search_products_input: 'Search by name or SKU...',
    add_product: 'Add Product',
    delete_all_products: 'Delete All Products',
    product_name: 'Product Name',
    sku: 'SKU',
    category: 'Category',
    price: 'Price',
    stock: 'Stock',
    actions: 'Actions',
    archived: 'Archived',
    no_products: 'No products found matching your search or filter.',
    save: 'Save',
    cancel: 'Cancel',

    // Customers
    search_customers: 'Search name, phone, or email...',
    add_customer: 'Add Customer',
    delete_all_customers: 'Delete All Customers',
    phone: 'Phone',
    email: 'Email',
    sms_consent: 'SMS Consent',
    registered: 'Registered',
    no_customers: 'No customers found matching your search.',

    // Sales History
    invoice_num: 'Invoice #',
    cashier: 'Cashier',
    date: 'Date',
    time: 'Time',
    items: 'Items',
    invoice_details: 'Invoice Details',
    close: 'Close',
    no_sales: 'No sales recorded yet.',

    // Settings
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    currency: 'Display Currency',
    currency_note: 'Note: Actual billing and receipts are always in PKR.'
  },

  ur: {
    // Navigation
    pos_terminal: 'پوائنٹ آف سیل',
    products: 'مصنوعات',
    categories: 'زمرہ جات',
    customers: 'صارفین',
    sales_history: 'فروخت کی تاریخ',
    settings: 'ترتیبات',
    logout: 'لاگ آؤٹ',

    // POS Terminal
    search_products: 'نام یا بارکوڈ/SKU سے تلاش کریں...',
    all_categories: 'تمام زمرہ جات',
    cart: 'موجودہ آرڈر',
    cart_empty: 'ٹوکری خالی ہے۔ اشیاء منتخب کریں۔',
    customer_select: 'گاہک',
    walk_in_customer: 'عام گاہک (Walk-in)',
    select_customer: 'گاہک منتخب کریں',
    add_new_customer: 'نیا گاہک',
    subtotal: 'ذیلی کل',
    discount: 'رعایت',
    tax: 'ٹیکس (5%)',
    total_due: 'کل رقم',
    payment_method: 'ادائیگی کا طریقہ',
    cash: 'نقد',
    card: 'کارڈ',
    card_type: 'کارڈ کی قسم',
    cardholder_name: 'کارڈ ہولڈر کا نام',
    last4_digits: 'آخری 4 ہندسے',
    auth_ref: 'ٹرانزیکشن ریفرنس',
    pay_and_print: 'ادائیگی اور رسید حاصل کریں',
    processing: 'عمل جاری ہے...',
    sale_successful: 'فروخت مکمل ہوگئی!',
    new_sale: 'نئی فروخت',
    print_receipt: 'رسید پرنٹ کریں',

    // Products
    products_and_inventory: 'مصنوعات اور اسٹاک',
    search_products_input: 'نام یا بارکوڈ سے تلاش کریں...',
    add_product: 'نئی چیز شامل کریں',
    delete_all_products: 'تمام اشیاء حذف کریں',
    product_name: 'پروڈکٹ کا نام',
    sku: 'ایس کے یو (SKU)',
    category: 'زمرہ',
    price: 'قیمت',
    stock: 'اسٹاک',
    actions: 'اقدامات',
    archived: 'محفوظ شدہ',
    no_products: 'کوئی پروڈکٹ نہیں ملی۔',
    save: 'محفوظ کریں',
    cancel: 'منسوخ کریں',

    // Customers
    search_customers: 'نام، فون یا ای میل سے تلاش کریں...',
    add_customer: 'نیا گاہک شامل کریں',
    delete_all_customers: 'تمام گاہک حذف کریں',
    phone: 'فون نمبر',
    email: 'ای میل',
    sms_consent: 'پیغام کی اجازت',
    registered: 'رجسٹریشن',
    no_customers: 'کوئی گاہک نہیں ملا۔',

    // Sales History
    invoice_num: 'انوائس نمبر',
    cashier: 'کیشیئر',
    date: 'تاریخ',
    time: 'وقت',
    items: 'اشیاء',
    invoice_details: 'انوائس کی تفصیلات',
    close: 'بند کریں',
    no_sales: 'ابھی تک کوئی فروخت درج نہیں ہے۔',

    // Settings
    theme: 'تھیم',
    light: 'روشن',
    dark: 'ڈارک موڈ',
    language: 'زبان',
    currency: 'ظاہری کرنسی',
    currency_note: 'نوٹ: حتمی بلنگ اور رسیدیں ہمیشہ پاکستانی روپے (PKR) میں ہوتی ہیں۔'
  }
};

/**
 * Format monetary amount with display currency conversion while always preserving PKR base.
 * @param {number} amountInPKR - Numeric amount in PKR
 * @param {string} displayCurrencyCode - Target currency (e.g. 'PKR', 'USD')
 * @param {boolean} showConvertedEquivalent - Whether to append secondary equivalent
 */
export function formatCurrency(amountInPKR, displayCurrencyCode = 'PKR', showConvertedEquivalent = false) {
  const numericPkr = Number(amountInPKR) || 0;
  const pkrFormatted = `₨ ${numericPkr.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  if (displayCurrencyCode === 'PKR' || !CURRENCIES[displayCurrencyCode]) {
    return pkrFormatted;
  }

  const targetCurrency = CURRENCIES[displayCurrencyCode];
  // Exchange rate: 1 unit of foreign currency = targetCurrency.rateToPKR PKR
  const convertedAmount = numericPkr / targetCurrency.rateToPKR;
  const foreignFormatted = `${targetCurrency.symbol} ${convertedAmount.toFixed(2)}`;

  if (showConvertedEquivalent) {
    return `${pkrFormatted} (~${foreignFormatted})`;
  }

  return `${foreignFormatted} (~${pkrFormatted})`;
}
