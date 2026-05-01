import initialConfig from './initial-config.json';

export const CATEGORIES = initialConfig.categories;
export const MOCK_PRODUCTS = initialConfig.products;
export const MOCK_ADDONS = initialConfig.addons.map((a, i) => ({ ...a, id: i + 1 }));
