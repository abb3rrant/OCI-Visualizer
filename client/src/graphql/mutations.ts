import { gql } from 'urql';

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      mfaRequired
      mfaSetupRequired
      mfaToken
      user {
        id
        email
        name
        role
        mfaEnabled
      }
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!, $name: String) {
    register(email: $email, password: $password, name: $name) {
      token
      user {
        id
        email
        name
        role
      }
      message
    }
  }
`;

export const APPROVE_USER_MUTATION = gql`
  mutation ApproveUser($userId: ID!) {
    approveUser(userId: $userId) {
      id
      approved
    }
  }
`;

export const REJECT_USER_MUTATION = gql`
  mutation RejectUser($userId: ID!) {
    rejectUser(userId: $userId)
  }
`;

export const CREATE_SNAPSHOT_MUTATION = gql`
  mutation CreateSnapshot($name: String!, $description: String, $importedAt: String) {
    createSnapshot(name: $name, description: $description, importedAt: $importedAt) {
      id
      name
      description
      importedAt
    }
  }
`;

export const DELETE_SNAPSHOT_MUTATION = gql`
  mutation DeleteSnapshot($id: ID!) {
    deleteSnapshot(id: $id)
  }
`;

export const UPDATE_USER_ROLE_MUTATION = gql`
  mutation UpdateUserRole($userId: ID!, $role: String!) {
    updateUserRole(userId: $userId, role: $role) {
      id
      role
    }
  }
`;

export const CREATE_TEAM_MUTATION = gql`
  mutation CreateTeam($name: String!) {
    createTeam(name: $name) {
      id
      name
    }
  }
`;

export const ADD_USER_TO_TEAM_MUTATION = gql`
  mutation AddUserToTeam($userId: ID!, $teamId: ID!) {
    addUserToTeam(userId: $userId, teamId: $teamId) {
      id
      team { id name }
    }
  }
`;

export const REMOVE_USER_FROM_TEAM_MUTATION = gql`
  mutation RemoveUserFromTeam($userId: ID!) {
    removeUserFromTeam(userId: $userId) {
      id
      team { id name }
    }
  }
`;

export const SHARE_SNAPSHOT_MUTATION = gql`
  mutation ShareSnapshot($snapshotId: ID!, $isShared: Boolean!) {
    shareSnapshot(snapshotId: $snapshotId, isShared: $isShared) {
      id
      isShared
    }
  }
`;

export const CREATE_AUDIT_RULE_MUTATION = gql`
  mutation CreateAuditRule($input: AuditRuleInput!) {
    createAuditRule(input: $input) {
      id
      name
      description
      resourceType
      fieldPath
      operator
      value
      severity
      message
      recommendation
      category
      framework
      enabled
    }
  }
`;

export const UPDATE_AUDIT_RULE_MUTATION = gql`
  mutation UpdateAuditRule($id: ID!, $input: AuditRuleInput!) {
    updateAuditRule(id: $id, input: $input) {
      id
      name
      description
      resourceType
      fieldPath
      operator
      value
      severity
      message
      recommendation
      category
      framework
      enabled
    }
  }
`;

export const DELETE_AUDIT_RULE_MUTATION = gql`
  mutation DeleteAuditRule($id: ID!) {
    deleteAuditRule(id: $id)
  }
`;

export const IMPORT_JSON_MUTATION = gql`
  mutation ImportJson($snapshotId: String!, $resourceType: String, $jsonData: String!) {
    importJson(snapshotId: $snapshotId, resourceType: $resourceType, jsonData: $jsonData) {
      resourceCount
      resourceTypes
      errors
    }
  }
`;

export const SETUP_MFA_MUTATION = gql`
  mutation SetupMfa {
    setupMfa {
      secret
      qrCodeDataUri
      backupCodes
    }
  }
`;

export const VERIFY_MFA_SETUP_MUTATION = gql`
  mutation VerifyMfaSetup($code: String!) {
    verifyMfaSetup(code: $code)
  }
`;

export const DISABLE_MFA_MUTATION = gql`
  mutation DisableMfa($password: String!) {
    disableMfa(password: $password)
  }
`;

export const VERIFY_MFA_LOGIN_MUTATION = gql`
  mutation VerifyMfaLogin($mfaToken: String!, $code: String!) {
    verifyMfaLogin(mfaToken: $mfaToken, code: $code) {
      token
      user {
        id
        email
        name
        role
        mfaEnabled
      }
    }
  }
`;

export const DISABLE_MFA_FOR_USER_MUTATION = gql`
  mutation DisableMfaForUser($userId: ID!) {
    disableMfaForUser(userId: $userId) {
      id
      mfaEnabled
    }
  }
`;

export const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

export const RESET_PASSWORD_FOR_USER_MUTATION = gql`
  mutation ResetPasswordForUser($userId: ID!, $newPassword: String!) {
    resetPasswordForUser(userId: $userId, newPassword: $newPassword) {
      id
    }
  }
`;

export const SET_MFA_REQUIRED_MUTATION = gql`
  mutation SetMfaRequired($userId: ID!, $required: Boolean!) {
    setMfaRequired(userId: $userId, required: $required) {
      id
      mfaRequired
    }
  }
`;
