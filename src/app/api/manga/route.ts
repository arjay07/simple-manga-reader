import { getSeriesList } from '@/lib/db-queries';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET() {
  try {
    return apiSuccess(getSeriesList());
  } catch (error) {
    console.error('Failed to fetch series:', error);
    return apiError('Failed to fetch series');
  }
}
