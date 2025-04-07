
import { Link } from "@remix-run/react";
import type { ButtonHTMLAttributes } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type CustomButtonProps = {
    children: any;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const CustomButton = ({ children, ...props }: CustomButtonProps) => {
    return (
        <button {...props}>
            {children}
        </button>
    );
};


type CustomLinkProps = {
    to: string;
    children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

export const CustomLink = ({ to, children, ...props }: CustomLinkProps) => {
    return (
        <Link to={to} {...props}>
            {children}
        </Link>
    );
};