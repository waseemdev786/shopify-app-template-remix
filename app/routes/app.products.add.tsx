import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { Product, ProductVariant, } from "@shopify/app-bridge-react";
import {
    Badge,
    BlockStack,
    Box,
    Button,
    Card,
    Collapsible,
    DatePicker,
    InlineStack,
    Layout,
    Page,
    Text
} from "@shopify/polaris";
import {
    ArrowLeftIcon
} from '@shopify/polaris-icons';
import { CustomButton } from "app/components/customComponents";
import prisma from "app/db.server";
import { CustomProduct, CustomVariant, FetcherData, MonthAndYear } from "app/helper/customTypes";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import { saveMetafield } from "app/helper/helper.server";



export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    if (productId) {
        try {
            const dbProduct = await prisma.product.findFirst({
                where: {
                    productId: productId,
                    sessionId: session.id
                },
            });
            return { dbProduct }
        } catch (error) {
            return { error: error instanceof Error ? error.message : "Something went wrong" }
        }
    }
    return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {

    const { session, admin, redirect } = await authenticate.admin(request);

    const selectedProduct = await request.json();
    if (selectedProduct) {
        try {
            await saveMetafield({ product: selectedProduct, admin });
        } catch (error) {
            console.log(error instanceof Error ? error.message : "Error occured while saving metafield")
        }
        try {
            const savedProduct = await prisma.product.create({
                data: {
                    productId: selectedProduct.productId,
                    title: selectedProduct.title,
                    sessionId: session.id,
                    variants: {
                        create: (selectedProduct.variants as CustomVariant[])
                    }
                },
            });
            if (savedProduct) {
                return redirect("/app/products/edit/" + savedProduct.id);
            }
            return { error: "Something went wrong" }
        } catch (error) {
            return { error: error instanceof Error ? error.message : "Something went wrong" }
        }
    }

    return null;
};

export default function ProductAdd() {

    const [selectedProduct, setSeletectProduct] = useState<CustomProduct | null>(null);
    const [collapsibleId, setCollapsibleId] = useState<string | null>(null);
    const [monthAndYear, setMonthAndYear] = useState<MonthAndYear>({ month: moment().month(), year: moment().year() });
    const [shopifyProduct, setShopifyProduct] = useState<Product | null>(null);
    const [existingProductError, setExistingProductError] = useState<any | null>(null);
    const fetcher = useFetcher();

    const handleProductSelection = useCallback(async () => {
        const response = await shopify.resourcePicker({ type: 'product', multiple: false, action: "select" });
        if (response && response.length > 0 && response[0]) {
            setShopifyProduct(response[0] as Product);
            fetcher.submit({ productId: response[0].id }, { method: "GET" })
        }
    }, [setShopifyProduct]);

    const handleSelectedProduct = useCallback(() => {
        if (!shopifyProduct) return;

        const startDate = moment().format('YYYY-MM-DD')
        const endDate = moment().add(10, 'days').format('YYYY-MM-DD'); 

        const selectedProduct: CustomProduct = {
            productId: shopifyProduct.id,
            title: shopifyProduct.title,
            variants: (shopifyProduct.variants as ProductVariant[]).map((variant) => ({
                variantId: variant.id,
                title: variant.title,
                startDate,
                endDate,
            }))
        }

        setSeletectProduct(selectedProduct);
        setExistingProductError(null);
        setShopifyProduct(null);
    }, [shopifyProduct, setSeletectProduct, setShopifyProduct, setExistingProductError]);

    const handleBulkCollapible = useCallback((productId: string) => {
        if (!selectedProduct) return;

        if (collapsibleId !== productId) {
            setMonthAndYear({
                month: moment(selectedProduct.variants[0].startDate).month(),
                year: moment(selectedProduct.variants[0].endDate).year(),
            });
        }
        setCollapsibleId((prevId) => (prevId === productId ? null : productId));
    }, [selectedProduct, collapsibleId, setMonthAndYear, setCollapsibleId]);

    const handleCollapsible = useCallback((variant: CustomVariant) => {
        if (collapsibleId !== variant.variantId) {
            setMonthAndYear({
                month: moment(variant.startDate).month(),
                year: moment(variant.startDate).year(),
            });
        }
        setCollapsibleId((prevId) => (prevId === variant.variantId ? null : variant.variantId));
    }, [collapsibleId, setMonthAndYear, setCollapsibleId]);

    const handleBulkDates = useCallback((selectedDates: { start: Date, end: Date }) => {
        console.log(selectedDates.start.toISOString());
        
        setSeletectProduct(prev => {
            if (!prev) return null;
            return {
                ...prev,
                variants: prev.variants.map((variant) => {
                    return {
                        ...variant,
                        startDate: moment(selectedDates.start).format('YYYY-MM-DD'),
                        endDate: moment(selectedDates.end).format('YYYY-MM-DD'),
                    };
                })
            }
        });
    }, [setSeletectProduct]);

    const handleSelectedDates = useCallback((variantId: string, selectedDates: { start: Date, end: Date }) => {
        setSeletectProduct(prev => {
            if (!prev) return null;
            return {
                ...prev,
                variants: prev.variants.map((variant) => {
                    if (variant.variantId === variantId) {
                        return {
                            ...variant,
                            startDate: moment(selectedDates.start).format('YYYY-MM-DD'),
                            endDate: moment(selectedDates.end).format('YYYY-MM-DD'),
                        };
                    }
                    return variant;
                })
            }
        });
    }, [setSeletectProduct])

    const saveProduct = useCallback(() => {
        fetcher.submit(selectedProduct, { method: "POST", encType: "application/json" })
    }, [selectedProduct]);

    useEffect(() => {
        if (fetcher.data) {
            const data = (fetcher?.data as FetcherData) || {};
            if (data.error) {
                shopify.toast.show(data.error, { duration: 3000, isError: true });
            }

            if ("dbProduct" in data) {
                const dbProduct = data.dbProduct;
                if (dbProduct) {
                    setExistingProductError(
                        <BlockStack inlineAlign="center" gap="300">
                            <Text as="p" alignment="center">
                                The product <b>{dbProduct.title}</b><br />
                                already exists in the database. Please update the existing entry instead of adding a new one.
                            </Text>
                            <Button variant="primary" url={"/app/products/edit/" + dbProduct.id}>Edit product</Button>
                        </BlockStack>
                    );
                    setSeletectProduct(null);
                } else {
                    handleSelectedProduct();
                }
            }
        }
    }, [fetcher.data])

    return (
        <Page>
            <Layout>

                <Layout.Section>
                    <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap={"300"} blockAlign="center">
                            <Button variant="tertiary" url="/app/products" icon={ArrowLeftIcon} accessibilityLabel="Back" />
                            <Text as="h2" variant="headingLg">Select a product</Text>
                        </InlineStack>
                        {selectedProduct &&
                            <InlineStack align="end" gap="300">
                                <Button variant="primary" onClick={saveProduct}>Save product</Button>
                                <Button variant="primary" onClick={handleProductSelection}>Change product</Button>
                            </InlineStack>
                        }
                    </InlineStack>
                </Layout.Section>

                <Layout.Section>
                    <Card>
                        {existingProductError ? existingProductError :
                            selectedProduct ? (
                                <BlockStack gap={"300"}>

                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text as="h2" variant="headingMd">{selectedProduct.title}</Text>
                                        {selectedProduct.variants.length > 1 && (
                                            <Button onClick={() => handleBulkCollapible(selectedProduct.productId)}>Bulk edit dates</Button>
                                        )}
                                    </InlineStack>

                                    {selectedProduct.variants.length > 1 && (
                                        <Collapsible
                                            id={selectedProduct.productId}
                                            open={collapsibleId === selectedProduct.productId}
                                            transition={{ duration: '300ms', timingFunction: 'ease-in-out' }}
                                        >
                                            <Box padding={"300"} borderColor="border-tertiary" borderWidth="025" borderRadius="300">
                                                <DatePicker
                                                    month={monthAndYear.month}
                                                    year={monthAndYear.year}
                                                    onChange={(selectedDates) => handleBulkDates(selectedDates)}
                                                    onMonthChange={(month: number, year: number) => setMonthAndYear({ month, year })}
                                                    selected={{
                                                        start: moment(selectedProduct.variants[0].startDate).toDate(),
                                                        end: moment(selectedProduct.variants[0].endDate).toDate(),
                                                    }}
                                                    multiMonth
                                                    allowRange
                                                />
                                            </Box>
                                        </Collapsible>
                                    )}



                                    <Box borderRadius="300" borderColor="border-tertiary" borderWidth="025" overflowX="hidden" overflowY="hidden">
                                        {selectedProduct?.variants?.map((variant) => {
                                            const variantId = variant.variantId;
                                            return (
                                                <BlockStack key={variantId}>
                                                    <CustomButton
                                                        className={collapsibleId === variantId ? "custom_btn custom_btn_active" : "custom_btn"}
                                                        onClick={() => handleCollapsible(variant)}
                                                    >
                                                        <Box padding={"300"}>
                                                            <InlineStack align="space-between" blockAlign="center" gap={"300"}>
                                                                <Text as="span">{variant.title}</Text>
                                                                <Badge>{`${moment(variant.startDate).format("DD/MM/YYYY")} - ${moment(variant.endDate).format("DD/MM/YYYY")}`}</Badge>
                                                            </InlineStack>
                                                        </Box>
                                                    </CustomButton>
                                                    <Collapsible
                                                        id={String(variantId)}
                                                        open={collapsibleId === variantId}
                                                        transition={{ duration: '300ms', timingFunction: 'ease-in-out' }}
                                                    >
                                                        <Box padding={"300"}>
                                                            <DatePicker
                                                                month={monthAndYear.month}
                                                                year={monthAndYear.year}
                                                                onChange={(selectedDates) => handleSelectedDates(variantId, selectedDates)}
                                                                onMonthChange={(month: number, year: number) => setMonthAndYear({ month, year })}
                                                                selected={{
                                                                    start: moment(variant.startDate).toDate(),
                                                                    end: moment(variant.endDate).toDate(),
                                                                }}
                                                                multiMonth
                                                                allowRange
                                                            />
                                                        </Box>
                                                    </Collapsible>
                                                </BlockStack>
                                            )
                                        })}
                                    </Box>

                                </BlockStack>
                            ) : (
                                <BlockStack inlineAlign="center" gap={"300"}>
                                    <Text as="h2" alignment="center">No product has been selected yet. <br /> To continue, please choose a product from your store.</Text>
                                    <Button variant="primary" onClick={handleProductSelection}>
                                        Select product
                                    </Button>
                                </BlockStack>
                            )
                        }
                    </Card>
                </Layout.Section>

            </Layout>
        </Page>
    );
}
