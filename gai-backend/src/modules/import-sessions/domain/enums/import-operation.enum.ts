export enum ImportOperation {
  CREATE_SESSION = 'create_session',
  RECEIVE_PAYLOAD = 'receive_payload',
  PROCESS_PAYLOAD = 'process_payload',
  FAIL_PAYLOAD = 'fail_payload',
  FINISH_SESSION = 'finish_session',
  CANCEL_SESSION = 'cancel_session',
  RETRY_SESSION = 'retry_session',
  REPROCESS_PAYLOAD = 'reprocess_payload',
  CREATE_FILE = 'create_file',
  CONFIRM_FILE = 'confirm_file',
  DOWNLOAD_FILE = 'download_file',
}
