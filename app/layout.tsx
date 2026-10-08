import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Punjab Map Studio — Regional Map Editor',description:'Explore district, tehsil and mandal maps for Punjab, Haryana, Himachal Pradesh, Andhra Pradesh, Rajasthan, Uttar Pradesh, Uttarakhand, Jammu & Kashmir and Ladakh, with a combined Kashmir claimed-boundary view.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
