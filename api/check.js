import { endpoint, jsonBody } from '../lib/http.js';
import { getService } from '../lib/service.js';
export default endpoint('POST', async req => getService().inspect((await jsonBody(req)).mint));
