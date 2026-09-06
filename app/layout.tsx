import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Punjab Map Studio — District Map Editor',description:'Color all 23 districts of Punjab, India. Customize labels, patterns and legends, then export your map.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
