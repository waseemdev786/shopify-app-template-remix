import { AdminApiContext } from "@shopify/shopify-app-remix/server";
type AdminApiContextWithoutRest = Omit<AdminApiContext, 'rest'>;
import { MixedProduct } from "./customTypes";

export const saveMetafield = async ({ product, admin }: {
    product: MixedProduct,
    admin: AdminApiContextWithoutRest
}) => {
    const mutation = `
      mutation ProductUpdate($productId: ID!, $value: String!) {
        productUpdate(input: {
          id: $productId,
          metafields: [
            {
              namespace: "sales_period",
              key: "sales_period",
              type: "json",
              value: $value
            }
          ]
        }) {
          product {
            metafield(namespace: "sales_period", key: "sales_period") {
              type
              value
            }
          }
        }
      }
    `;

    try {
        const formatedProduct = {
            productId: product.productId,
            title: product.title,
            variants: product.variants.map((variant) => ({
                variantId: variant.variantId,
                title: variant.title,
                startDate: variant.startDate,
                endDate: variant.endDate,
            })),
        };

        const metafieldResp = await admin.graphql(mutation, {
            variables: {
                productId: product.productId,
                value: JSON.stringify(formatedProduct)
            }
        });

        const metafieldJsonResp = await metafieldResp.json();

        if (!metafieldJsonResp?.data?.productUpdate?.product?.metafield?.value) {
            throw new Error("Shopify response missing metafield value");
        }

        return metafieldJsonResp.data.productUpdate.product.metafield.value;
    } catch (error: any) {
        console.log("Failed to save metafield:", error);
        throw new Error("Could not save data to Shopify");
    }
};

export const deleteMetafield = async ({ productId, admin }: {
    productId: string;
    admin: AdminApiContextWithoutRest;
}) => {
    try {
        const mutation = `
          mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
            metafieldsDelete(metafields: $metafields) {
                deletedMetafields {
                    key
                    namespace
                    ownerId
                }
                userErrors {
                    field
                    message
                }
            }
        }
      `;

        const deleteResp = await admin.graphql(mutation, {
            variables: {
                metafields: [
                    {
                        key: "sales_period",
                        namespace: "sales_period",
                        ownerId: productId
                    }
                ]
            },
        });

        const deleteJson = await deleteResp.json();
        const errors = deleteJson?.data?.metafieldsDelete?.userErrors;

        if (errors?.length) {
            throw new Error(errors.map((e: any) => e.message).join(", "));
        }

        return deleteJson.data.metafieldsDelete.deletedMetafields;

    } catch (error: any) {
        console.log("Failed to delete metafield:", error);
        throw new Error("Could not delete metafield from Shopify");
    }
};
