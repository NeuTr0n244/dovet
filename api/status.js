import { endpoint } from '../lib/http.js';
import { getService } from '../lib/service.js';
export default endpoint('GET', () => getService().status());
