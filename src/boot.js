import { failStartup } from './ui/startup-status.js'

// The HTML placeholder is already visible while this module and the app arrive.
import('./main.js').catch(failStartup)
