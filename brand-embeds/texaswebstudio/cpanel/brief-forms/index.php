<?php
/**
 * Texas Web Studio — brief form embed for cPanel.
 * Upload this folder to: public_html/brief-forms/
 *
 * URLs:
 *   https://texaswebstudio.co/brief-forms/graphic-design/
 *   https://texaswebstudio.co/brief-forms/seo-questionnaire/
 *   etc.
 */

$crmOrigin = 'https://dashboard.bmybrand.com'; // CRM production URL (no trailing slash)
$brandSlug = 'texaswebstudio';

$allowed = [
  'seo-questionnaire',
  'website',
  'logo-design',
  'graphic-design',
  'video-animation',
  'smm',
];

// Support /brief-forms/{slug}/ via PATH_INFO or rewrite to index.php?form=slug
$formType = '';

if (!empty($_GET['form'])) {
  $formType = strtolower(trim((string) $_GET['form']));
} elseif (!empty($_SERVER['PATH_INFO'])) {
  $formType = strtolower(trim(basename((string) $_SERVER['PATH_INFO'])));
} else {
  $requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
  // /brief-forms/graphic-design or /brief-forms/graphic-design/
  if (preg_match('#/brief-forms/([a-z0-9\-]+)/?$#i', $requestUri, $m)) {
    $formType = strtolower($m[1]);
  }
}

if ($formType === '' || $formType === 'index.php') {
  http_response_code(404);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!DOCTYPE html><html><head><title>Brief form</title></head><body style="font-family:sans-serif;padding:2rem;">';
  echo '<h1>Brief form not found</h1><p>Open a form URL like <code>/brief-forms/graphic-design/</code>.</p>';
  echo '</body></html>';
  exit;
}

if (!in_array($formType, $allowed, true)) {
  http_response_code(404);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!DOCTYPE html><html><head><title>Brief form</title></head><body style="font-family:sans-serif;padding:2rem;">';
  echo '<h1>Unknown brief form</h1><p>Valid forms: ' . htmlspecialchars(implode(', ', $allowed), ENT_QUOTES, 'UTF-8') . '</p>';
  echo '</body></html>';
  exit;
}

$src = rtrim($crmOrigin, '/') . '/brief-forms/' . rawurlencode($formType) . '?brand=' . rawurlencode($brandSlug);
$title = 'Brief form | Texas Web Studio';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
    iframe { display: block; width: 100%; height: 100vh; height: 100dvh; border: 0; background: #fff; }
  </style>
</head>
<body>
  <iframe
    src="<?= htmlspecialchars($src, ENT_QUOTES, 'UTF-8') ?>"
    title="Texas Web Studio brief form"
    allow="clipboard-write"
  ></iframe>
</body>
</html>
