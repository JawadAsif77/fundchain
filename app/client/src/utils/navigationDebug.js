/**
 * Simple navigation debug utility
 */
export const navigationDebug = {
  enabled: process.env.NODE_ENV === 'development',
  
  log(component, action, details = {}) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`🧭 [${timestamp}] ${component}: ${action}`, details);
  },
  
  warn(component, warning, details = {}) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    console.warn(`⚠️ [${timestamp}] ${component}: ${warning}`, details);
  },
  
  error(component, error, details = {}) {
    const timestamp = new Date().toLocaleTimeString();
    console.error(`❌ [${timestamp}] ${component}: ${error}`, details);
  }
};

export default navigationDebug;