import { kernelStorage } from '@/kernel/kernelStorage.js';

export interface VaultFile {
  path: string;
  name: string;
  content: string;
  lastSynced: string;
  version: number;
}

export interface VaultProject {
  id: string;
  name: string;
  files: VaultFile[];
  updatedAt: string;
}

const STORAGE_KEYS = {
  vault: 'novaura_asset_vault_', // Will be prefixed with userId
};

class VaultService {
  private getStorageKey(userId: string) {
    return `${STORAGE_KEYS.vault}${userId}`;
  }

  getVault(userId: string): VaultProject[] {
    const data = kernelStorage.getItem(this.getStorageKey(userId));
    return data ? JSON.parse(data) : [];
  }

  saveProjectToVault(userId: string, project: VaultProject) {
    const vault = this.getVault(userId);
    const existingIndex = vault.findIndex(p => p.id === project.id);
    
    if (existingIndex >= 0) {
      vault[existingIndex] = {
        ...project,
        updatedAt: new Date().toISOString()
      };
    } else {
      vault.push({
        ...project,
        updatedAt: new Date().toISOString()
      });
    }
    
    kernelStorage.setItem(this.getStorageKey(userId), JSON.stringify(vault));
  }

  // Auto-mirror logic for IDE files
  mirrorFile(userId: string, projectId: string, projectName: string, file: VaultFile) {
    const vault = this.getVault(userId);
    let project = vault.find(p => p.id === projectId);
    
    if (!project) {
      project = {
        id: projectId,
        name: projectName,
        files: [],
        updatedAt: new Date().toISOString()
      };
      vault.push(project);
    }
    
    const existingFileIndex = project.files.findIndex(f => f.path === file.path);
    if (existingFileIndex >= 0) {
      project.files[existingFileIndex] = {
        ...file,
        lastSynced: new Date().toISOString(),
        version: (project.files[existingFileIndex].version || 0) + 1
      };
    } else {
      project.files.push({
        ...file,
        lastSynced: new Date().toISOString(),
        version: 1
      });
    }
    
    project.updatedAt = new Date().toISOString();
    kernelStorage.setItem(this.getStorageKey(userId), JSON.stringify(vault));
  }

  restoreProject(userId: string, projectId: string): VaultProject | undefined {
    const vault = this.getVault(userId);
    return vault.find(p => p.id === projectId);
  }
}

export const vaultService = new VaultService();
