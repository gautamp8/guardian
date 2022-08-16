import { EventBlock } from '@policy-engine/helpers/decorators';
import { PolicyComponentsUtils } from '@policy-engine/policy-components-utils';
import { ChildrenType, ControlType } from '@policy-engine/interfaces/block-about';
import { PolicyInputEventType } from '@policy-engine/interfaces';
import { IPolicyUser } from '@policy-engine/policy-user';
import { GenerateUUIDv4, GroupAccessType, GroupRelationshipType } from '@guardian/interfaces';
import { BlockActionError } from '@policy-engine/errors';
import { AnyBlockType } from '@policy-engine/policy-engine.interface';

interface IUserGroup {
    /**
     * policyId
     */
    policyId: string,
    /**
     * did
     */
    did: string,
    /**
     * did
     */
    owner: string,
    /**
     * uuid
     */
    uuid: string,
    /**
     * role
     */
    role: string,
    /**
     * groupRelationshipType
     */
    groupRelationshipType: GroupRelationshipType,
    /**
     * groupAccessType
     */
    groupAccessType: GroupAccessType
}

/**
 * Policy roles block
 */
@EventBlock({
    blockType: 'policyRolesBlock',
    commonBlock: false,
    about: {
        label: 'Roles',
        title: `Add 'Choice Of Roles' Block`,
        post: true,
        get: true,
        children: ChildrenType.None,
        control: ControlType.UI,
        input: [
            PolicyInputEventType.RunEvent,
            PolicyInputEventType.RefreshEvent,
        ],
        output: null,
        defaultEvent: false
    }
})
export class PolicyRolesBlock {

    private getGroupConfig(ref: AnyBlockType, role: string): any {
        console.log(ref.policyInstance);

        const policyGroups = ref.policyInstance.policyGroups || [];
        const groupConfig = policyGroups.find(e => e.role === role);
        if (groupConfig) {
            return groupConfig;
        } else {
            const policyRoles = ref.policyInstance.policyRoles || [];
            const roleConfig = policyRoles.find(e => e === role);
            if (roleConfig) {
                return {
                    role: roleConfig,
                    groupRelationshipType: GroupRelationshipType.Single,
                    groupAccessType: GroupAccessType.Private
                }
            } else {
                throw new Error(`Role "${role}" does not exist`);
            }
        }
    }

    private async getGroupByConfig(ref: AnyBlockType, did: string, groupConfig: any): Promise<IUserGroup> {
        if (groupConfig.groupRelationshipType === GroupRelationshipType.Multiple) {
            if (groupConfig.groupAccessType === GroupAccessType.Global) {
                const result = await ref.databaseServer.getGroupByName(ref.policyId, groupConfig.role);
                if (result) {
                    return {
                        policyId: ref.policyId,
                        did,
                        owner: null,
                        uuid: result.uuid,
                        role: result.role,
                        groupRelationshipType: result.groupRelationshipType,
                        groupAccessType: result.groupAccessType
                    }
                } else {
                    return {
                        policyId: ref.policyId,
                        did,
                        owner: null,
                        uuid: GenerateUUIDv4(),
                        role: groupConfig.role,
                        groupRelationshipType: GroupRelationshipType.Multiple,
                        groupAccessType: GroupAccessType.Global
                    };
                }
            } else {
                return {
                    policyId: ref.policyId,
                    did,
                    owner: did,
                    uuid: GenerateUUIDv4(),
                    role: groupConfig.role,
                    groupRelationshipType: GroupRelationshipType.Multiple,
                    groupAccessType: GroupAccessType.Private
                }
            }
        } else {
            return {
                policyId: ref.policyId,
                did,
                owner: did,
                uuid: GenerateUUIDv4(),
                role: groupConfig.role,
                groupRelationshipType: GroupRelationshipType.Single,
                groupAccessType: GroupAccessType.Private
            }
        }
    }

    private async getGroupByToken(ref: AnyBlockType, did: string, token: string): Promise<IUserGroup> {
        const uuid = token;
        const result = await ref.databaseServer.getGroup(ref.policyId, uuid);
        if (!result) {
            throw new BlockActionError('Invalid token', ref.blockType, ref.uuid);
        }
        const group = {
            policyId: ref.policyId,
            did,
            owner: result.owner,
            uuid: result.uuid,
            role: result.role,
            groupRelationshipType: result.groupRelationshipType,
            groupAccessType: result.groupAccessType
        }
        return group;
    }

    /**
     * Get block data
     * @param user
     */
    async getData(user: IPolicyUser): Promise<any> {
        const ref = PolicyComponentsUtils.GetBlockRef(this);
        return {
            roles: Array.isArray(ref.options.roles) ? ref.options.roles : [],
            uiMetaData: ref.options.uiMetaData
        }
    }

    /**
     * Set block data
     * @param user
     * @param data
     */
    async setData(user: IPolicyUser, data: any): Promise<any> {
        const ref = PolicyComponentsUtils.GetBlockRef(this);
        const did = user?.did;

        if (!did) {
            throw new BlockActionError('Invalid user', ref.blockType, ref.uuid);
        }

        let group: IUserGroup;
        if (data.invitation) {
            group = await this.getGroupByToken(ref, did, data.invitation);
        } else if (data.role) {
            const groupConfig = this.getGroupConfig(ref, data.role);
            group = await this.getGroupByConfig(ref, did, groupConfig);
        } else {
            throw new BlockActionError('Invalid role', ref.blockType, ref.uuid);
        }

        const result = await ref.databaseServer.setUserInGroup(group);

        await Promise.all([
            PolicyComponentsUtils.BlockUpdateFn(ref.parent.uuid, {}, user, ref.tag),
            PolicyComponentsUtils.UpdateUserInfoFn(user, ref.policyInstance)
        ]);
        return true;
    }
}
