/**
 * The cookie that remembers whether the menu bar is folded away.
 *
 * In its own module, and deliberately NOT in the client component that writes it. A module
 * marked "use client" hands the server a client-reference proxy for every export, including
 * plain constants — so a server component importing the name from there would call
 * cookies().get(<proxy>) and silently read nothing at all. The bar folded, then sprang open
 * on the next navigation, with no error anywhere.
 */
export const NAV_COOKIE = "apex_nav";
export const NAV_COLLAPSED = "collapsed";
