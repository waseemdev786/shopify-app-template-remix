import type {
  CartLine,
  FunctionError,
  FunctionRunResult,
  RunInput
} from "../generated/api";

interface SalesPeriodVariant {
  variantId: string;
  title: string;
  start: string;
  end: string;
}

interface SalesPeriod {
  variants: SalesPeriodVariant[];
}

export function run(input: RunInput): FunctionRunResult {
  const errors: FunctionError[] = [];
  const cartLines = input?.cart?.lines || [];
  const shop = input.shop;

  const getSalesStatus = ({ now, start, end }: { now: string, start: string, end: string }) => {
    
    console.log(JSON.stringify({ now, start, end }))

    const dateNow = new Date(now);
    const dateStart = new Date(start);
    const dateEnd = new Date(end);

    if (dateNow < dateStart) return 'upcoming';
    if (dateNow >= dateStart && dateNow <= dateEnd) return 'active';
    return 'expired';
  }

  for (const rawLine of cartLines) {
    const line = rawLine as CartLine;
    const merchandise = line.merchandise;

    if (merchandise.__typename === "ProductVariant") {
      const product = merchandise.product;
      const salesPeriod: SalesPeriod | undefined = product?.metafield?.jsonValue;

      if (salesPeriod) {
        const variant = salesPeriod.variants.find(
          (v) => v.variantId === merchandise.id
        );

        if (variant) {
          const status = getSalesStatus({
            now: new Date(new Date(shop.localTime.date).setHours(23, 59, 59, 999)).toISOString(),
            start: variant.start,
            end: variant.end
          });
          console.log(status);
          
          if (status === "upcoming") {
            errors.push({
              localizedMessage: `The sales period for "${product.title}" has not started yet.`,
              target: "cart",
            });
          } else if (status === "expired") {
            errors.push({
              localizedMessage: `The sales period for "${product.title}" has ended.`,
              target: "cart",
            });
          }
        }

      }
    }
  }

  return {
    errors,
  };
}
