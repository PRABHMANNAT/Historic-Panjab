import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Punjab Map Studio — Regional Map Editor',description:'Explore and color districts and tehsils across Punjab, Haryana, Himachal Pradesh and neighbouring regions. Customize labels, patterns and legends, then export your map.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
