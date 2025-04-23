import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { ProductVariant } from "@shopify/app-bridge-react";
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
import { DbProduct, FetcherData, MixedProduct, MixedVariant, MonthAndYear } from "app/helper/customTypes";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import { deleteMetafield, saveMetafield } from "app/helper/helper.server";


export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const id = params.id;

    if (!id || isNaN(parseInt(id))) throw new Response("Not Found", { status: 404 });

    const product = await prisma.product.findUnique({
        where: {
            id: parseInt(id),
            sessionId: session.id
        },
        include: {
            variants: true
        }
    })

    if (!product) throw new Response("Not Found", { status: 404 });

    return { product };
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session, admin, redirect } = await authenticate.admin(request);
    const reqMethod = request.method;

    const { id, productId, selectedProduct } = await request.json();
    if (reqMethod === "DELETE" && id && productId) {
        try {
            await deleteMetafield({ productId, admin });
        } catch (error) {
            console.log(error instanceof Error ? error.message : "Error occured while deleting metafield")
        }
        try {
            await prisma.product.delete({
                where: {
                    sessionId: session.id,
                    id: id
                }
            });
            return redirect("/app/products");
        } catch (error) {
            return { error: error instanceof Error ? error.message : "Something went wrong" }
        }
    }

    if (reqMethod === "PUT" && selectedProduct) {
        try {
            await saveMetafield({ product: selectedProduct, admin });
        } catch (error) {
            console.log(error instanceof Error ? error.message : "Error occured while saving metafield")
        }
        try {
            const dbProduct = await prisma.product.update({
                where: {
                    id: selectedProduct.id,
                    sessionId: session.id
                },
                data: {
                    productId: selectedProduct.productId,
                    title: selectedProduct.title,
                    updatedAt: new Date().toISOString(),
                    variants: {
                        deleteMany: {},
                        create: selectedProduct.variants.map((variant: MixedVariant) => ({
                            variantId: variant.variantId,
                            title: variant.title,
                            startDate: variant.startDate,
                            endDate: variant.endDate,
                        }))
                    }
                }
            });
            return { dbProduct }
        } catch (error) {
            return { error: error instanceof Error ? error.message : "Something went wrong" }
        }
    }

    return null;
}

export default function ProductEdit() {

    const { product } = useLoaderData<typeof loader>();
    if (!product) return null;

    const [dbProduct, setDbProduct] = useState<DbProduct | MixedProduct>(product);
    const [selectedProduct, setSeletectProduct] = useState<DbProduct | MixedProduct>(product);

    const [collapsibleId, setCollapsibleId] = useState<string | null>(null);
    const [monthAndYear, setMonthAndYear] = useState<MonthAndYear>({ month: moment().month(), year: moment().year() });


    const fetcher = useFetcher();

    const handleProductSelection = useCallback(async () => {

        const response = await shopify.resourcePicker({
            type: 'variant',
            multiple: true,
            action: "select",
            filter: { query: "product_id:" + selectedProduct.productId.replace("gid://shopify/Product/", "") },
            selectionIds: selectedProduct.variants.map(variant => ({ id: variant.variantId }))
        });

        if (response && response.length > 0) {
            const newVariants: MixedVariant[] = [];
            const existingVariants: MixedVariant[] = [];
            const startDate = moment().format('YYYY-MM-DD');
            const endDate = moment().add(10, 'days').format('YYYY-MM-DD');

            (response as ProductVariant[]).forEach((variant: ProductVariant) => {

                const existingVariant = selectedProduct.variants.find((v: MixedVariant) => v.variantId === variant.id);

                if (existingVariant) {
                    existingVariants.push(existingVariant);
                } else {
                    newVariants.push({
                        variantId: variant.id,
                        title: variant.title,
                        startDate,
                        endDate,
                    });
                }
            });

            // Combine the new and existing variants into one array
            const product: MixedProduct = {
                ...selectedProduct,
                variants: [...existingVariants, ...newVariants],
            };

            setSeletectProduct(product)
        }

    }, [selectedProduct, setSeletectProduct]);


    const handleBulkCollapible = useCallback((productId: string) => {
        if (collapsibleId !== productId) {
            setMonthAndYear({
                month: moment(selectedProduct.variants[0].startDate).month(),
                year: moment(selectedProduct.variants[0].endDate).year(),
            });
        }
        setCollapsibleId((prevId) => (prevId === productId ? null : productId));
    }, [selectedProduct, collapsibleId, setMonthAndYear, setCollapsibleId]);

    const handleCollapsible = useCallback((variant: MixedVariant) => {
        if (collapsibleId !== variant.variantId) {
            setMonthAndYear({
                month: moment(variant.startDate).month(),
                year: moment(variant.startDate).year(),
            });
        }
        setCollapsibleId((prevId) => (prevId === variant.variantId ? null : variant.variantId));
    }, [collapsibleId, setMonthAndYear, setCollapsibleId]);

    const handleBulkDates = useCallback((selectedDates: { start: Date, end: Date }) => {
        setSeletectProduct(prev => {
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
        fetcher.submit({ selectedProduct }, { method: "PUT", encType: "application/json" })
    }, [fetcher, selectedProduct]);

    const discardChanges = useCallback(() => {
        setSeletectProduct(dbProduct)
    }, [dbProduct, setSeletectProduct])

    const deleteProduct = useCallback(() => {
        fetcher.submit({ id: selectedProduct.id, productId: selectedProduct.productId }, { method: "DELETE", encType: "application/json" })
    }, [selectedProduct])

    useEffect(() => {
        if (fetcher.data) {

            const data = (fetcher?.data as FetcherData) || {};

            if (data.error) {
                shopify.toast.show(data.error, { duration: 3000, isError: true });
            }

            if (data.dbProduct) {
                const product: MixedProduct = {
                    ...dbProduct,
                    variants: selectedProduct.variants
                }
                setSeletectProduct(product)
                setDbProduct(product)
                shopify.toast.show("Product updated", { duration: 3000 });
            }
        }
    }, [fetcher.data])

    const isChanged = JSON.stringify(dbProduct) !== JSON.stringify(selectedProduct);

    return (
        <Page>
            <Layout>
                <Layout.Section>
                    <InlineStack align="space-between" gap={"300"}>

                        <InlineStack gap={"300"} blockAlign="center">
                            <Button variant="tertiary" url="/app/products" icon={ArrowLeftIcon} accessibilityLabel="Back" />
                            <Text as="h2" variant="headingLg">Edit: {selectedProduct.title}</Text>
                        </InlineStack>

                        <InlineStack align="end" gap="300">
                            {isChanged && <Button variant="primary" onClick={saveProduct}>Save Product</Button>}
                            {isChanged && <Button variant="primary" onClick={discardChanges}>Discard Changes</Button>}
                            <Button variant="primary" onClick={handleProductSelection}>Change variants</Button>
                            <Button variant="primary" onClick={deleteProduct}>Delete Product</Button>
                        </InlineStack>

                    </InlineStack>
                </Layout.Section>

                <Layout.Section>
                    <Card>
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
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
