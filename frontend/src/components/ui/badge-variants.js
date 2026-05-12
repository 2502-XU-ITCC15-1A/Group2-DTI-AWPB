import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "group/badge inline-flex h-7 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-3 py-1 text-sm font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent [a]:hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground border-transparent [a]:hover:bg-secondary/80",
        destructive: "bg-destructive/10 text-destructive border-transparent [a]:hover:bg-destructive/20",
        outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",

        statusPending: "border-yellow-200 bg-yellow-100 text-yellow-800",
        statusReturned: "border-red-200 bg-red-100 text-red-700",
        statusRejected: "border-slate-300 bg-slate-100 text-slate-600",
        statusApproved: "border-green-200 bg-green-100 text-green-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
