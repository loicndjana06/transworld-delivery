import Cargo from './cargo';
import { getChatGPTUser } from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return <Cargo signedIn={!!user} displayName={user?.displayName||''}/>;}
