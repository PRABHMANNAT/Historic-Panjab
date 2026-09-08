import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import RegionalEditor from './app/extended-editor';
import './app/globals.css';

const root=document.getElementById('root');
if(!root)throw new Error('Map application root was not found');

createRoot(root).render(<StrictMode><RegionalEditor/></StrictMode>);
