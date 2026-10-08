import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Punjab Map Studio — Regional Map Editor',description:'Explore Punjab and 24 Indian state and UT district/subdistrict maps, including tehsils, mandals and taluks, with a combined Kashmir claimed-boundary view.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
