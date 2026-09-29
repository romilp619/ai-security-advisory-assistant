import { configStatus } from '@/lib/config';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({...configStatus(), dataset: 'production', accessRequired: Boolean(process.env.RESEARCH_ACCESS_TOKEN) || process.env.NODE_ENV === 'production'}, {headers: {'Cache-Control':'no-store'}});
}
