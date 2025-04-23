import type {
  CartLine,
  FunctionError,
  FunctionRunResult,
  RunInput
} from "../generated/api";

interface SalesPeriodVariant {
  variantId: string;
  title: string;
  startDate: string;
  endDate: string;
}

interface SalesPeriod {
  variants: SalesPeriodVariant[];
}

export function run(input: RunInput): FunctionRunResult {
  const errors: FunctionError[] = [];
  const cartLines = input?.cart?.lines || [];
  const shop = input.shop;
    
  const getSalesStatus = ({ todayDate, startDate, endDate }:
    { todayDate: string, startDate: string, endDate: string }) => {
    // Log the values for debugging
    console.log(JSON.stringify({ todayDate, startDate, endDate }));

    // Convert the string dates to Date objects
    const dateToday = new Date(todayDate);  // today's date
    const dateStart = new Date(startDate); // start date
    const dateEnd = new Date(endDate);    // end date
  
    // Determine the sales status based on the dates
    if (dateToday < dateStart) return 'upcoming';
    if (dateToday >= dateStart && dateToday <= dateEnd) return 'active';
    return 'expired';
  };

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
            todayDate: shop.localTime.date,
            startDate: variant.startDate,
            endDate: variant.endDate
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
