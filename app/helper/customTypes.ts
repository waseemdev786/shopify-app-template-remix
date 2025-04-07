
export type ProductsLoaderData = {
  products: {
    id: number;
    productId: string;
    title: string;
    createdAt: string;
    updatedAt?: string | null;
    sessionId: string;
    _count: {
      variants: number;
    };
  }[];
  totalProducts: number;
  currentPage: number;
  totalPages: number;
};

export type CustomVariant = {
  variantId: string;
  title: string;
  start: string;
  end: string;
};

export type CustomProduct = {
  productId: string;
  title: string;
  variants: CustomVariant[];
};

export type DbVariant = {
  id: number;
  variantId: string;
  title: string;
  start: string;
  end: string;
  productId: number
}

export type DbProduct = {
  id: number;
  productId: string;
  title: string;
  createdAt: string;
  updatedAt?: string | null;
  sessionId: string
  variants: DbVariant[];
};

export type MixedVariant = {
  id?: number;
  variantId: string;
  title: string;
  start: string;
  end: string;
  productId?: number
}

export type MixedProduct = {
  id: number;
  productId: string;
  title: string;
  createdAt: string;
  updatedAt?: string | null;
  sessionId: string
  variants: MixedVariant[];
}

export type FetcherData = {
  dbProduct?: DbProduct;
  error?: string;
};

export type MonthAndYear = {
  month: number;
  year: number;
};