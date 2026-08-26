/** Parent-only routes are gated on this header, checked against PARENT_KEY. */
export const isParent = (req: Request) => !!process.env.PARENT_KEY && req.headers.get("x-parent-key") === process.env.PARENT_KEY;
