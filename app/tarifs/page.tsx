import Cargo from '../cargo';
import {getAdminUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getAdminUser();return <Cargo signedIn={!!user} displayName={user?.displayName||''} initialView='pricing'/>;}
