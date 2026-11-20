// Shared constants: navigation, example commands, step/trigger types.
export const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'automations', label: 'My Automations', icon: '⚡' },
  { key: 'command', label: 'Create Automation', icon: '✦' },
  { key: 'builder', label: 'Visual Builder', icon: '⛓' },
  { key: 'integrations', label: 'Integrations', icon: '🔌' },
  { key: 'history', label: 'Execution History', icon: '🕘' },
  { key: 'templates', label: 'Templates', icon: '📋' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
  { key: 'profile', label: 'Profile', icon: '👤' },
];

export const EXAMPLE_COMMANDS = [
  'Whenever someone submits my contact form, save their information in the database and send me an email.',
  'When a new order is received, send a WhatsApp notification to the admin.',
  'Every day at 9 AM, send me a summary of new orders.',
  'When a customer registers, send them a welcome email.',
  'When an order is marked as completed, update its status and notify the customer.',
  'When a WhatsApp message is received, send a WhatsApp auto-reply.',
];

export const TRIGGER_TYPES = [
  { type: 'manual', label: 'Manual trigger' },
  { type: 'form_submission', label: 'When a contact form is submitted' },
  { type: 'new_order', label: 'When a new order is received' },
  { type: 'order_completed', label: 'When an order is marked as completed' },
  { type: 'customer_registered', label: 'When a customer registers' },
  { type: 'whatsapp_message', label: 'When a WhatsApp message is received' },
  { type: 'schedule', label: 'Every day at 9:00 AM' },
];

export const STEP_TYPES = [
  { type: 'condition', label: 'Condition / Filter' },
  { type: 'save_record', label: 'Save record in database' },
  { type: 'generate_summary', label: 'Generate summary' },
  { type: 'update_status', label: 'Update status' },
  { type: 'send_email', label: 'Send email (Gmail)' },
  { type: 'send_whatsapp', label: 'Send WhatsApp message' },
  { type: 'send_telegram', label: 'Send Telegram message' },
  { type: 'send_discord', label: 'Send Discord message' },
  { type: 'send_slack', label: 'Send Slack message' },
  { type: 'http_call', label: 'Webhook / REST API call' },
  { type: 'delay', label: 'Delay' },
];
