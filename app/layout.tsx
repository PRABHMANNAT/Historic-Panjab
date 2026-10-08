import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={applicationName:'Prabh Map Studio',authors:[{name:'Prabhmannat Singh',url:'https://github.com/PRABHMANNAT'}],creator:'Prabhmannat Singh (Prabh)',icons:{icon:'/favicon.svg'},title:'Prabh Map Studio — South Asia Research Atlas',description:'Open-source mapping software for South Asia research, developed and created by Prabhmannat Singh (Prabh). Explore boundaries, style regional maps, and export your work.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
