import { authenticateCron, endpoint } from '../lib/http.js';
import { getService } from '../lib/service.js';
export default endpoint('GET', req => getService().runDaily({ trigger: authenticateCron(req) }));
