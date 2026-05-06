export enum ApiEndpoints {
  /** Auth endpoints **/
  authLogin = "AUTH_LOGIN",
  authRefreshToken = "AUTH_REFRESH_TOKEN",
  authGetUser = "AUTH_GET_USER",

  /** Promo Codes endpoints **/
  promoCodesGet = "PROMO_CODES_GET",
  promoCodesPost = "PROMO_CODES_POST",
  promoCodesUpdate = "PROMO_CODES_UPDATE",
  promoCodesDelete = "PROMO_CODES_DELETE",
  promoCodesGetById = "PROMO_CODES_BY_ID",
  promoCodeTypes = "PROMO_CODE_TYPES",

  /** Manufacturers endpoints **/
  manufacturersGet = "MANUFACTURERS_GET",
  manufacturersPost = "MANUFACTURERS_POST",
  manufacturersUpdate = "MANUFACTURERS_UPDATE",
  manufacturersDelete = "MANUFACTURERS_DELETE",
  manufacturersGetById = "MANUFACTURERS_BY_ID",

  /** Dealers endpoints **/
  dealersGet = "DEALERS_GET",
  dealersPost = "DEALERS_POST",
  dealersUpdate = "DEALERS_UPDATE",
  dealersDelete = "DEALERS_DELETE",
  dealersGetById = "DEALERS_BY_ID",

  /** Advertisements endpoints **/
  advertisementsGet = "ADVERTISEMENT_GET",
  advertisementsPost = "ADVERTISEMENT_POST",
  advertisementsUpdate = "ADVERTISEMENT_UPDATE",
  advertisementsDelete = "ADVERTISEMENT_DELETE",
  advertisementsGetById = "ADVERTISEMENT_BY_ID",

  /** Product Categories endpoints **/
  productCategoriesGet = "PRODUCT_CATEGORIES_GET",
  productCategoriesPost = "PRODUCT_CATEGORIES_POST",
  productCategoriesUpdate = "PRODUCT_CATEGORIES_UPDATE",
  productCategoriesDelete = "PRODUCT_CATEGORIES_DELETE",
  productCategoriesGetById = "PRODUCT_CATEGORIES_BY_ID",

  /** Gifts endpoints **/
  giftsGetGift = "GIFTS_GET_GIFT",
  giftsGet = "GIFTS_GET",
  giftsPost = "GIFTS_POST",
  giftsUpdate = "GIFTS_UPDATE",
  giftsDelete = "GIFTS_DELETE",
  giftsGetById = "GIFTS_BY_ID",

  /** Products endpoints **/
  productsGetGift = "PRODUCTS_GET_GIFT",
  productsGet = "PRODUCTS_GET",
  productsPost = "PRODUCTS_POST",
  productsUpdate = "PRODUCTS_UPDATE",
  productsDelete = "PRODUCTS_DELETE",
  productsGetById = "PRODUCTS_BY_ID",

  /** Partners endpoints **/
  partnersGet = "PARTNERS_GET",
  partnersPost = "PARTNERS_POST",
  partnersUpdate = "PARTNERS_UPDATE",
  partnersDelete = "PARTNERS_DELETE",
  partnersGetById = "PARTNERS_BY_ID",

  /** Channels endpoints **/
  channelsGet = "CHANNELS_GET",
  channelsPost = "CHANNELS_POST",
  channelsUpdate = "CHANNELS_UPDATE",
  channelsDelete = "CHANNELS_DELETE",
  channelsGetById = "CHANNELS_BY_ID",

  /** SuperPrize endpoints **/
  superPrizeGet = "SUPER_PRIZE_GET",
  superPrizePost = "SUPER_PRIZE_POST",
  superPrizeUpdate = "SUPER_PRIZE_UPDATE",
  superPrizeDelete = "SUPER_PRIZE_DELETE",
  superPrizeGetById = "SUPER_PRIZE_BY_ID",

  /** Regions endpoints **/
  regionsGetAll = "REGIONS_GET_ALL",

  /** Game Types endpoints **/
  gameTypesGetAll = "GAME_TYPES_GET_ALL",
  gameTypesGetById = "GAME_TYPES_BY_ID",
  gameTypesUpdate = "GAME_TYPES_UPDATE",

  /** Users endpoints **/
  usersGet = "USERS_GET_ALL",
  usersGetById = "USERS_BY_ID",
  usersUpdate = "USERS_UPDATE",

  /** Users endpoints **/
  languageGet = "USERS_GET_ALL",
  languageById = "USERS_BY_ID",
}
