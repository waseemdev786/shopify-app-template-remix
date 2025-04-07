import type { LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
    Badge,
    BlockStack,
    Box,
    Button,
    Card,
    Icon,
    InlineStack,
    Layout,
    Page,
    Pagination,
    Text,
    TextField
} from "@shopify/polaris";
import {
    SearchIcon
} from '@shopify/polaris-icons';
import { CustomLink } from "app/components/customComponents";
import prisma from "app/db.server";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import { ProductsLoaderData } from "app/helper/customTypes";


export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(10, parseInt(url.searchParams.get("pageSize") || "10"));
    const query = url.searchParams.get("query") || "";

    const whereClause = {
        sessionId: session.id,
        ...(query ? { title: { contains: query } } : {})
    }

    const [totalProducts, products] = await Promise.all([
        prisma.product.count({
            where: whereClause,
        }),
        prisma.product.findMany({
            where: whereClause,
            include: {
                _count: {
                    select: {
                        variants: true,
                    },
                },
            },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
    ]);

    return { products, totalProducts, currentPage: page, totalPages: Math.ceil(totalProducts / pageSize) };
};

export default function Products() {

    const loaderData = useLoaderData<typeof loader>();
    const [{ products, totalProducts, currentPage, totalPages }, setLoaderData] = useState<ProductsLoaderData>(loaderData);

    const [query, setQuery] = useState("");
    const fetcher = useFetcher();

    const handleFilter = useCallback((key: string, value: any) => {
        const filterData: Record<string, any> = {
            query: key === "query" ? value.trim() : query.trim(),
            page: key === "page" ? value : 1,
        };

        for (const k in filterData) {
            if (filterData[k] === undefined || filterData[k] === null || filterData[k] === '') {
                delete filterData[k];
            }
        }

        fetcher.submit(filterData, { method: "GET" });
    }, [query]);

    useEffect(() => {
        // Ensure fetcher.data is typed correctly
        if (fetcher.data) {
            setLoaderData(fetcher.data as ProductsLoaderData); // Casting fetcher.data as ProductsLoaderData
        }
    }, [fetcher.data]);

    return (
        <Page>
            <Layout>

                <Layout.Section>
                    <InlineStack gap={"300"} align="space-between">
                        <Text as="h2" variant="headingLg">Products</Text>
                        <Button variant="primary" url="/app/products/add">Add product</Button>
                    </InlineStack>
                </Layout.Section>

                <Layout.Section>
                    <Card>
                        <BlockStack gap={"300"}>

                            <Box>
                                <TextField
                                    type="search"
                                    autoComplete="off"
                                    label="Search product"
                                    labelHidden={true}
                                    placeholder="Search product by title"
                                    clearButton={true}
                                    onClearButtonClick={() => {
                                        setQuery("");
                                        handleFilter("query", "");
                                    }}
                                    prefix={<Icon source={SearchIcon} />}
                                    value={query}
                                    onChange={(value) => {
                                        setQuery(value);
                                        handleFilter("query", value);
                                    }}
                                    loading={fetcher.state === "loading"}
                                />
                            </Box>

                            {(products && products.length > 0) ? (
                                <Box borderRadius="300" borderColor="border-tertiary" borderWidth="025" overflowX="hidden" overflowY="hidden">
                                    {products?.map((product) => {
                                        const productId = product.id;
                                        const variantCount = product._count.variants;
                                        return (
                                            <CustomLink
                                                to={"/app/products/edit/" + productId}
                                                className="custom_btn"
                                                onClick={() => { }}
                                                key={productId}
                                            >
                                                <Box padding={"300"}>
                                                    <InlineStack align="space-between" blockAlign="center" gap={"300"}>
                                                        <Text as="span">{product.title}</Text>
                                                        <Badge>{variantCount > 1 ? `${variantCount} variants` : `${variantCount} variant`}</Badge>
                                                    </InlineStack>
                                                </Box>
                                            </CustomLink>
                                        )
                                    })}
                                </Box>
                            ) : (
                                <Box padding={"300"}>
                                    <Text as="p" alignment="center">No products found</Text>
                                </Box>
                            )}

                            {(products && products.length > 0) && (
                                <InlineStack align="center">
                                    <Pagination
                                        hasNext={totalPages > currentPage}
                                        hasPrevious={currentPage > 1}
                                        onNext={() => handleFilter("page", currentPage + 1)}
                                        onPrevious={() => handleFilter("page", currentPage - 1)}
                                        label={totalPages ? `Showing page ${currentPage} of ${totalPages} - Total products: ${totalProducts}` : null}
                                    />
                                </InlineStack>
                            )}
                        </BlockStack>
                    </Card>
                </Layout.Section>

            </Layout>
        </Page>
    );
}
