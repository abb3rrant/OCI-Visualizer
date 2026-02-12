import { gql } from 'urql';

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        name
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
      }
    }
  }
`;

export const CREATE_SNAPSHOT_MUTATION = gql`
  mutation CreateSnapshot($name: String!, $description: String) {
    createSnapshot(name: $name, description: $description) {
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

export const IMPORT_JSON_MUTATION = gql`
  mutation ImportJson($snapshotId: ID!, $resourceType: String!, $jsonData: String!) {
    importJson(snapshotId: $snapshotId, resourceType: $resourceType, jsonData: $jsonData) {
      resourceCount
      resourceTypes
      errors
    }
  }
`;
