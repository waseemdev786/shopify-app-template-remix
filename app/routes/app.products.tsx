import { Outlet } from "@remix-run/react";

export const loader = () => {
    return null
}

export default function Products() {
    return (
        <Outlet />
    )
}