import {prepareNature,type NatureRequest} from './nature-data';
self.onmessage=async(event:MessageEvent<NatureRequest>)=>{
 try{self.postMessage(await prepareNature(event.data));}
 catch(error){self.postMessage({key:event.data.key,error:error instanceof Error?error.message:'Nature layers could not load'});}
};
