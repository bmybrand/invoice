<?php
/**
 * Copy this file to config.php on your cPanel server (same folder as brief-forms.php).
 * Do not commit config.php — it contains database credentials.
 */
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'your_cpanel_database',
    'db_user' => 'your_cpanel_db_user',
    'db_pass' => 'your_cpanel_db_password',

    // Must match CPANEL_BRIEF_FORMS_BRIDGE_SECRET in Vercel
    'bridge_secret' => 'replace-with-a-long-random-secret',

    // Optional: restrict browser CORS (Vercel server calls are not affected by CORS)
    'allowed_origins' => [
        'https://your-app.vercel.app',
        'http://localhost:3000',
    ],
];
