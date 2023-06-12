/**
 * Message api
 */
export enum MessageAPI {
    PUBLISH_TASK = 'publish-task',
    GET_DID_DOCUMENTS = 'get-did-documents',
    GET_VC_DOCUMENTS = 'get-vc-documents',
    SET_DID_DOCUMENT = 'set-did-document',
    SET_VC_DOCUMENT = 'set-vc-document',
    GET_SCHEMAS = 'get-schemas',
    GET_TOKENS = 'get-tokens',
    GET_TOKEN = 'get-token',
    SET_TOKEN = 'set-token',
    SET_TOKEN_ASYNC = 'set-token-async',
    UPDATE_TOKEN_ASYNC = 'update-token-async',
    DELETE_TOKEN_ASYNC = 'delete-token-async',
    IMPORT_TOKENS = 'import-tokens',
    LOAD_DID_DOCUMENT = 'load-did-document',
    LOAD_SCHEMA_DOCUMENT = 'load-schema-document',
    LOAD_SCHEMA_CONTEXT = 'load-schema-context',
    GET_VP_DOCUMENTS = 'get-vp-documents',
    GET_CHAIN = 'get-chain',
    SET_VP_DOCUMENT = 'set-vp-document',
    IMPORT_SCHEMA = 'import-schema',
    EXPORT_SCHEMAS = 'export-schema',
    PUBLISH_SCHEMA = 'publish-schema',
    PUBLISH_SCHEMA_ASYNC = 'publish-schema-async',
    UNPUBLISHED_SCHEMA = 'unpublished-schema',
    DELETE_SCHEMA = 'delete-schema',
    PREVIEW_SCHEMA = 'preview-schema',
    PREVIEW_SCHEMA_ASYNC = 'preview-schema-async',
    IPFS_ADD_FILE = 'ipfs-add-file',
    IPFS_ADD_FILE_ASYNC = 'ipfs-add-file-async',
    IPFS_GET_FILE = 'ipfs-get-file',
    IPFS_GET_FILE_ASYNC = 'ipfs-get-file-async',
    GET_SCHEMA = 'get-schema',
    GENERATE_DEMO_KEY = 'GENERATE_DEMO_KEY',
    GENERATE_DEMO_KEY_ASYNC = 'GENERATE_DEMO_KEY_ASYNC',
    IMPORT_SCHEMAS_BY_MESSAGES = 'IMPORT_SCHEMAS_BY_MESSAGES',
    IMPORT_SCHEMAS_BY_MESSAGES_ASYNC = 'IMPORT_SCHEMAS_BY_MESSAGES_ASYNC',
    IMPORT_SCHEMAS_BY_FILE = 'IMPORT_SCHEMAS_BY_FILE',
    IMPORT_SCHEMAS_BY_FILE_ASYNC = 'IMPORT_SCHEMAS_BY_FILE_ASYNC',
    INCREMENT_SCHEMA_VERSION = 'INCREMENT_SCHEMA_VERSION',
    UPDATE_SETTINGS = 'UPDATE_SETTINGS',
    GET_SETTINGS = 'GET_SETTINGS',
    WRITE_LOG = 'WRITE_LOG',
    GET_LOGS = 'GET_LOGS',
    FREEZE_TOKEN = 'FREEZE_TOKEN',
    FREEZE_TOKEN_ASYNC = 'FREEZE_TOKEN_ASYNC',
    KYC_TOKEN = 'KYC_TOKEN',
    KYC_TOKEN_ASYNC = 'KYC_TOKEN_ASYNC',
    ASSOCIATE_TOKEN = 'ASSOCIATE_TOKEN',
    ASSOCIATE_TOKEN_ASYNC = 'ASSOCIATE_TOKEN_ASYNC',
    GET_ASSOCIATED_TOKENS = 'GET_ASSOCIATED_TOKENS',
    GET_INFO_TOKEN = 'GET_INFO_TOKEN',
    CREATE_STANDARD_REGISTRY = 'CREATE_STANDARD_REGISTRY',
    CREATE_USER_PROFILE = 'CREATE_USER_PROFILE',
    CREATE_USER_PROFILE_COMMON = 'CREATE_USER_PROFILE_COMMON',
    CREATE_USER_PROFILE_COMMON_ASYNC = 'CREATE_USER_PROFILE_COMMON_ASYNC',
    RESTORE_USER_PROFILE_COMMON_ASYNC = 'RESTORE_USER_PROFILE_COMMON_ASYNC',
    GET_USER_BALANCE = 'GET_USER_BALANCE',
    GET_TOPIC = 'GET_TOPIC',
    GET_ATTRIBUTES = 'GET_ATTRIBUTES',
    GET_STATUS = 'GET_STATUS',
    SEND_STATUS = 'SEND_STATUS',
    UPDATE_STATUS = 'UPDATE_STATUS',
    CREATE_SCHEMA = 'CREATE_SCHEMA',
    CREATE_SCHEMA_ASYNC = 'CREATE_SCHEMA_ASYNC',
    UPDATE_SCHEMA = 'UPDATE_SCHEMA',
    GET_USER_ROLES = 'GET_USER_ROLES',
    CREATE_SYSTEM_SCHEMA = 'CREATE_SYSTEM_SCHEMA',
    GET_SYSTEM_SCHEMAS = 'GET_SYSTEM_SCHEMAS',
    ACTIVE_SCHEMA = 'ACTIVE_SCHEMA',
    GET_SYSTEM_SCHEMA = 'GET_SYSTEM_SCHEMA',
    GET_BALANCE = 'GET_BALANCE',
    GET_ENVIRONMENT = 'GET_ENVIRONMENT',
    UPDATE_TASK_STATUS = 'UPDATE_TASK_STATUS',
    UPLOAD_ARTIFACT = 'UPLOAD_ARTIFACT',
    GET_ARTIFACTS = 'GET_ARTIFACTS',
    DELETE_ARTIFACT = 'DELETE_ARTIFACT',
    GET_ALL_USER_TOPICS_ASYNC = 'GET_ALL_USER_TOPICS_ASYNC',
    COMPARE_POLICIES = 'COMPARE_POLICIES',
    COMPARE_SCHEMAS = 'COMPARE_SCHEMAS',
    GET_CONTRACT = 'GET_CONTRACT',
    CREATE_CONTRACT = 'CREATE_CONTRACT',
    IMPORT_CONTRACT = 'IMPORT_CONTRACT',
    GET_CONTRACT_PAIR = 'GET_CONTRACT_PAIR',
    CHECK_CONTRACT_STATUS = 'CHECK_CONTRACT_STATUS',
    ADD_CONTRACT_PAIR = 'ADD_CONTRACT_PAIR',
    ADD_CONTRACT_USER = 'ADD_CONTRACT_USER',
    ADD_RETIRE_REQUEST = 'ADD_RETIRE_REQUEST',
    GET_RETIRE_REQUEST = 'GET_RETIRE_REQUEST',
    RETIRE_TOKENS = 'RETIRE_TOKENS',
    CANCEL_RETIRE_REQUEST = 'CANCEL_RETIRE_REQUEST',
    GET_LIST_SCHEMAS = 'GET_LIST_SCHEMAS',
    CREATE_MODULE = 'CREATE_MODULE',
    GET_MODULE = 'GET_MODULE',
    GET_MODULES = 'GET_MODULES',
    DELETE_MODULES = 'DELETE_MODULES',
    PUBLISH_MODULES = 'PUBLISH_MODULES',
    UPDATE_MODULES = 'UPDATE_MODULES',
    IMPORT_MODULES = 'IMPORT_MODULES',
    EXPORT_MODULES = 'EXPORT_MODULES',
    MODULE_EXPORT_FILE = 'MODULE_EXPORT_FILE',
    MODULE_EXPORT_MESSAGE = 'MODULE_EXPORT_MESSAGE',
    IMPORT_MODULES_BY_MESSAGES = 'IMPORT_MODULES_BY_MESSAGES',
    IMPORT_MODULES_BY_FILE = 'IMPORT_MODULES_BY_FILE',
    GET_MENU_MODULES = 'GET_MENU_MODULES',
    SHOW_MODULES = 'SHOW_MODULES',
    MODULE_IMPORT_FILE = 'MODULE_IMPORT_FILE',
    MODULE_IMPORT_MESSAGE = 'MODULE_IMPORT_MESSAGE',
    MODULE_IMPORT_FILE_PREVIEW = 'MODULE_IMPORT_FILE_PREVIEW',
    MODULE_IMPORT_MESSAGE_PREVIEW = 'MODULE_IMPORT_MESSAGE_PREVIEW',
    VALIDATE_MODULES = 'VALIDATE_MODULES',
    GET_MAP_API_KEY = 'GET_MAP_API_KEY',
    CREATE_TAG = 'CREATE_TAG',
    GET_TAGS = 'GET_TAGS',
    DELETE_TAG = 'DELETE_TAG',
    EXPORT_TAGS = 'EXPORT_TAGS',
    GET_TAG_CACHE = 'GET_TAG_CACHE',
    GET_SYNCHRONIZATION_TAGS = 'GET_SYNCHRONIZATION_TAGS',
    GET_TAG_SCHEMAS = 'GET_TAG_SCHEMAS',
    CREATE_TAG_SCHEMA = 'CREATE_TAG_SCHEMA',
    PUBLISH_TAG_SCHEMA = 'PUBLISH_TAG_SCHEMA',
    GET_PUBLISHED_TAG_SCHEMAS = 'GET_PUBLISHED_TAG_SCHEMAS',
    CREATE_THEME = 'CREATE_THEME',
    UPDATE_THEME = 'UPDATE_THEME',
    GET_THEMES = 'GET_THEMES',
    GET_THEME = 'GET_THEME',
    DELETE_THEME = 'DELETE_THEME',
    THEME_EXPORT_FILE = 'THEME_EXPORT_FILE',
    THEME_IMPORT_FILE = 'THEME_IMPORT_FILE',
    WIZARD_POLICY_CREATE = 'WIZARD_POLICY_CREATE',
    WIZARD_POLICY_CREATE_ASYNC = 'WIZARD_POLICY_CREATE_ASYNC',
    WIZARD_GET_POLICY_CONFIG = 'WIZARD_GET_POLICY_CONFIG'
}

/**
 * External message api events
 */
export enum ExternalMessageEvents {
    TOKEN_MINTED = 'external-events.token_minted',
    ERROR_LOG = 'external-events.error_logs',
    BLOCK_EVENTS = 'external-events.block_event',
    IPFS_ADDED_FILE = 'external-events.ipfs_added_file',
    IPFS_BEFORE_UPLOAD_CONTENT = 'external-events.ipfs_before_upload_content',
    IPFS_AFTER_READ_CONTENT = 'external-events.ipfs_after_read_content',
    IPFS_LOADED_FILE = 'external-events.ipfs_loaded_file',
}
