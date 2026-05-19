<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(503);
    echo json_encode(['error' => 'Bridge not configured. Copy config.sample.php to config.php.']);
    exit;
}

/** @var array<string, mixed> $config */
$config = require $configPath;

$secret = (string) ($_SERVER['HTTP_X_BRIDGE_SECRET'] ?? '');
$expectedSecret = (string) ($config['bridge_secret'] ?? '');
if ($expectedSecret === '' || !hash_equals($expectedSecret, $secret)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$allowedOrigins = $config['allowed_origins'] ?? [];
if (is_array($allowedOrigins) && count($allowedOrigins) > 0) {
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Bridge-Secret');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        (string) ($config['db_host'] ?? 'localhost'),
        (int) ($config['db_port'] ?? 3306),
        (string) ($config['db_name'] ?? '')
    );
    $pdo = new PDO(
        $dsn,
        (string) ($config['db_user'] ?? ''),
        (string) ($config['db_pass'] ?? ''),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed.']);
    exit;
}

$validFormTypes = [
    'seo-questionnaire',
    'website',
    'logo-design',
    'graphic-design',
    'video-animation',
];

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON body.']);
        exit;
    }

    $formType = trim((string) ($body['formType'] ?? ''));
    $payload = $body['payload'] ?? null;

    if (!in_array($formType, $validFormTypes, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid brief form type.']);
        exit;
    }

    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['error' => 'Submission payload is required.']);
        exit;
    }

    $submitterEmail = isset($body['submitterEmail']) ? trim((string) $body['submitterEmail']) : null;
    if ($submitterEmail === '') {
        $submitterEmail = null;
    }

    $submittedByAuthId = isset($body['submittedByAuthId']) ? trim((string) $body['submittedByAuthId']) : null;
    if ($submittedByAuthId === '') {
        $submittedByAuthId = null;
    }

    $source = trim((string) ($body['source'] ?? 'public'));
    if ($source === '') {
        $source = 'public';
    }

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO brief_form_submissions
                (form_type, payload, submitter_email, submitted_by_auth_id, source)
             VALUES
                (:form_type, :payload, :submitter_email, :submitted_by_auth_id, :source)'
        );
        $stmt->execute([
            ':form_type' => $formType,
            ':payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            ':submitter_email' => $submitterEmail,
            ':submitted_by_auth_id' => $submittedByAuthId,
            ':source' => $source,
        ]);

        echo json_encode([
            'id' => (int) $pdo->lastInsertId(),
            'formType' => $formType,
        ]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not save submission. Ensure brief_form_submissions exists.']);
    }
    exit;
}

if ($method === 'GET') {
    $formType = trim((string) ($_GET['formType'] ?? ''));
    $limit = (int) ($_GET['limit'] ?? 50);
    if ($limit < 1) {
        $limit = 1;
    }
    if ($limit > 200) {
        $limit = 200;
    }

    if ($formType !== '' && !in_array($formType, $validFormTypes, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid brief form type.']);
        exit;
    }

    try {
        if ($formType !== '') {
            $stmt = $pdo->prepare(
                'SELECT id, form_type, payload, submitter_email, submitted_by_auth_id, source, created_at
                 FROM brief_form_submissions
                 WHERE form_type = :form_type
                 ORDER BY created_at DESC
                 LIMIT :limit'
            );
            $stmt->bindValue(':form_type', $formType, PDO::PARAM_STR);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        } else {
            $stmt = $pdo->prepare(
                'SELECT id, form_type, payload, submitter_email, submitted_by_auth_id, source, created_at
                 FROM brief_form_submissions
                 ORDER BY created_at DESC
                 LIMIT :limit'
            );
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        }
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $submissions = array_map(static function (array $row): array {
            $payload = $row['payload'];
            if (is_string($payload)) {
                $decoded = json_decode($payload, true);
                $payload = is_array($decoded) ? $decoded : [];
            }

            return [
                'id' => (int) $row['id'],
                'formType' => $row['form_type'],
                'payload' => $payload,
                'submitterEmail' => $row['submitter_email'],
                'submittedByAuthId' => $row['submitted_by_auth_id'],
                'source' => $row['source'],
                'createdAt' => $row['created_at'],
            ];
        }, $rows);

        echo json_encode(['submissions' => $submissions]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not load submissions.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed.']);
