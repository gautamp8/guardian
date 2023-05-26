import {
    BlockType,
    GenerateUUIDv4,
    IGridConfig,
    ISchemaRoleConfig,
    IWizardConfig,
    IWizardSchemaConfig,
    IWizardTrustChainConfig,
} from '@guardian/interfaces';

/**
 * Policy wizard helper
 */
export class PolicyWizardHelper {
    /**
     * Block counter
     */
    private blockCounter: number = 0;

    /**
     * Generate block tag
     * @returns Tag
     */
    private generateBlockTag() {
        this.blockCounter++;
        return 'Block_' + this.blockCounter;
    }

    /**
     * Create policy config
     * @param wizardConfig config
     * @returns Policy config
     */
    public createPolicyConfig(wizardConfig: IWizardConfig): any {
        const root: any = {
            id: GenerateUUIDv4(),
            blockType: BlockType.Container,
            permissions: ['ANY_ROLE'],
        };
        this.blockCounter = 0;
        const { roles, schemas, trustChain } = wizardConfig;
        root.children = [this.getChooseRoleBlock(roles)];
        const children = root.children;
        const roleContainers: any = {};
        const roleTabContainers: any = {};
        roles.forEach((role) => {
            roleContainers[role] = this.getRoleContainer(role);
            roleTabContainers[role] = roleContainers[role];
        });

        const approveRejectInitialSteps: {
            [key: string]: {
                // tslint:disable-next-line:completed-docs
                approveBlockTags: string[];
                // tslint:disable-next-line:completed-docs
                rejectBlockTags: string[];
            };
        } = {};
        for (const schema of schemas) {
            const approveBlockTags = [];
            const rejectBlockTags = [];
            approveRejectInitialSteps[schema.iri] = {
                approveBlockTags,
                rejectBlockTags,
            };
            for (const roleInitialSchemaFor of schema.initialRolesFor) {
                const stepContainer = this.getRoleStep(roleInitialSchemaFor);
                roleContainers[roleInitialSchemaFor] = stepContainer;
                const [_, rejectInfoBlockTag] = this.createInitialSchemaSteps(
                    roleInitialSchemaFor,
                    stepContainer,
                    roleTabContainers[roleInitialSchemaFor],
                    schema
                );
                approveBlockTags.push(
                    roleTabContainers[roleInitialSchemaFor].tag
                );
                rejectBlockTags.push(rejectInfoBlockTag);
            }
        }

        for (const schema of schemas) {
            for (const roleConfig of schema.rolesConfig) {
                const roleSchemaTabContainer =
                    this.putSchemasStepsIntoContainer(
                        roleConfig,
                        schema,
                        schemas,
                        this.getTabContainer(roleConfig.role, schema.name),
                        approveRejectInitialSteps[schema.iri]?.approveBlockTags,
                        approveRejectInitialSteps[schema.iri]?.rejectBlockTags
                    );

                if (roleTabContainers[roleConfig.role]) {
                    roleTabContainers[roleConfig.role].children.push(
                        roleSchemaTabContainer
                    );
                } else {
                    roleContainers[roleConfig.role].children.push(
                        roleSchemaTabContainer
                    );
                }
            }
        }

        for (const trustChainConfig of trustChain) {
            const [roleTrustChainTabContainer, trustChainTag] =
                this.putTrustChainStepsIntoContainer(
                    trustChainConfig,
                    schemas,
                    this.getTabContainer(trustChainConfig.role, 'Trust Chain')
                );
            const vpGridTabContainer = this.createVPGrid(
                trustChainConfig,
                trustChainTag,
                this.getTabContainer(trustChainConfig.role, 'Token History')
            );
            if (roleTabContainers[trustChainConfig.role]) {
                roleTabContainers[trustChainConfig.role].children.push(
                    vpGridTabContainer,
                    roleTrustChainTabContainer
                );
            } else {
                roleContainers[trustChainConfig.role].children.push(
                    vpGridTabContainer,
                    roleTrustChainTabContainer
                );
            }
        }

        for (const roleContainer of Object.values(roleContainers)) {
            children.push(roleContainer);
        }

        return root;
    }

    /**
     * Create initial steps
     * @param role Role
     * @param container Container
     * @param schemaConfig Schema config
     * @returns Container
     */
    private createInitialSchemaSteps(
        role: string,
        container: any,
        roleTabContainer: any,
        schemaConfig: IWizardSchemaConfig
    ) {
        const requestDocument = this.getRequestDocumentBlock(
            role,
            schemaConfig.iri
        );
        const sendBlock = this.getDocumentSendBlock(
            role,
            false,
            schemaConfig.isApproveEnable
        );
        container.children?.push(requestDocument, sendBlock);

        if (schemaConfig.isApproveEnable) {
            const infoBlock = this.getInfoBlock(
                role,
                'Submitted to approve',
                'The page will be automatically refreshed'
            );
            container.children?.push(infoBlock);
        }

        container?.children.push(roleTabContainer);

        let rejectInfoBlockTag;
        if (schemaConfig.isApproveEnable) {
            const rejectInfoBlock = this.getInfoBlock(
                role,
                'Rejected',
                'Document was rejected'
            );
            rejectInfoBlockTag = rejectInfoBlock.tag;
            container.children?.push(rejectInfoBlock);
        }

        return [container, rejectInfoBlockTag];
    }

    /**
     * Create schema container
     * @param roleConfig Role config
     * @param schemaConfig Schema config
     * @param schemaConfigs Schema configs
     * @param container Container
     * @param approveBtnTag Approve button tag
     * @param rejectBtnTag Reject button tag
     * @returns Container
     */
    private putSchemasStepsIntoContainer(
        roleConfig: ISchemaRoleConfig,
        schemaConfig: IWizardSchemaConfig,
        schemaConfigs: IWizardSchemaConfig[],
        container: any,
        approvedBlockTags: string[] = [],
        rejectedBlockTags: string[] = []
    ) {
        const dependencySchema = schemaConfigs.find(
            (schema) => schema.iri === schemaConfig.dependencySchemaIri
        );
        const relationshipSchema = schemaConfigs.find(
            (schema) => schema.iri === schemaConfig.relationshipsSchemaIri
        );
        const gridBlock = this.getDocumentsGrid(
            roleConfig.role,
            roleConfig.gridColumns
        );
        container.children?.push(gridBlock);

        let createDependencySchemaAddonTag;
        if (schemaConfig.isApproveEnable) {
            const toApproveOrRejectAddon = this.getDocumentsSourceAddon(
                roleConfig.role,
                schemaConfig.iri,
                !roleConfig.isApprover,
                [
                    {
                        value: 'Waiting for approval',
                        field: 'option.status',
                        type: 'equal',
                    },
                ]
            );
            const approvedAddon = this.getDocumentsSourceAddon(
                roleConfig.role,
                schemaConfig.iri,
                !roleConfig.isApprover,
                [
                    {
                        value: 'approved_entity',
                        field: 'type',
                        type: 'equal',
                    },
                ]
            );
            const rejectedAddon = this.getDocumentsSourceAddon(
                roleConfig.role,
                schemaConfig.iri,
                !roleConfig.isApprover,
                [
                    {
                        value: 'rejected_entity',
                        field: 'type',
                        type: 'equal',
                    },
                ]
            );
            createDependencySchemaAddonTag = approvedAddon.tag;
            gridBlock?.children?.push(
                toApproveOrRejectAddon,
                approvedAddon,
                rejectedAddon
            );

            if (roleConfig.isApprover) {
                const saveDocumentApprove =
                    this.getChangeDocumentStatusSendBlock(
                        roleConfig.role,
                        'Approved'
                    );
                const saveDocumentReject =
                    this.getChangeDocumentStatusSendBlock(
                        roleConfig.role,
                        'Rejected'
                    );
                const buttonsBlock = this.getApproveRejectButtonsBlock(
                    roleConfig.role,
                    saveDocumentApprove.tag,
                    saveDocumentReject.tag
                );
                const approveRejectField = this.getApproveRejectField(
                    buttonsBlock.tag,
                    toApproveOrRejectAddon.tag
                );
                gridBlock.uiMetaData.fields.push(approveRejectField);
                container.children?.push(
                    buttonsBlock,
                    saveDocumentApprove,
                    this.getReassignBlock(roleConfig.role),
                    this.getDocumentSendBlock(
                        roleConfig.role,
                        !schemaConfig.isMintSchema,
                        false,
                        'approved_entity',
                        approvedBlockTags
                    )
                );
                if (schemaConfig.isMintSchema) {
                    container.children?.push(
                        this.getMintBlock(
                            roleConfig.role,
                            schemaConfig.mintOptions.tokenId,
                            schemaConfig.mintOptions.rule
                        )
                    );
                }
                container.children?.push(
                    saveDocumentReject,
                    this.getReassignBlock(roleConfig.role),
                    this.getDocumentSendBlock(
                        roleConfig.role,
                        true,
                        false,
                        'rejected_entity',
                        rejectedBlockTags
                    )
                );
            }
        } else {
            const documentsSourceAddon = this.getDocumentsSourceAddon(
                roleConfig.role,
                schemaConfig.iri
            );
            createDependencySchemaAddonTag = documentsSourceAddon.tag;
            gridBlock?.children?.push(documentsSourceAddon);
        }

        if (roleConfig.isCreator) {
            let requestDocumentBlock = this.getDialogRequestDocumentBlock(
                roleConfig.role,
                schemaConfig.iri,
                false,
                schemaConfig.name
            );
            container.children?.push(requestDocumentBlock);
            if (relationshipSchema) {
                container.children?.push(
                    this.getSetRelationshipsBlock(
                        roleConfig.role,
                        relationshipSchema.iri,
                        relationshipSchema.isApproveEnable
                    )
                );
            }
            if (schemaConfig.isApproveEnable) {
                container.children?.push(
                    this.getDocumentSendBlock(roleConfig.role, true, true)
                );
            } else {
                container.children?.push(
                    this.getDocumentSendBlock(
                        roleConfig.role,
                        !schemaConfig.isMintSchema,
                        false
                    )
                );

                if (schemaConfig.isMintSchema) {
                    container.children?.push(
                        this.getMintBlock(
                            roleConfig.role,
                            schemaConfig.mintOptions.tokenId,
                            schemaConfig.mintOptions.rule
                        )
                    );
                }
            }
            if (dependencySchema && createDependencySchemaAddonTag) {
                requestDocumentBlock = this.getDialogRequestDocumentBlock(
                    roleConfig.role,
                    dependencySchema.iri,
                    true,
                    dependencySchema.name
                );
                container.children?.push(
                    requestDocumentBlock,
                    this.getDocumentSendBlock(
                        roleConfig.role,
                        !dependencySchema.isMintSchema,
                        dependencySchema.isApproveEnable
                    )
                );

                if (
                    !dependencySchema.isApproveEnable &&
                    dependencySchema.isMintSchema
                ) {
                    container.children?.push(
                        this.getMintBlock(
                            roleConfig.role,
                            dependencySchema.mintOptions.tokenId,
                            dependencySchema.mintOptions.rule
                        )
                    );
                }
                gridBlock.uiMetaData.fields.push(
                    this.getCreateDependencySchemaColumn(
                        `Create ${dependencySchema.name}`,
                        requestDocumentBlock.tag,
                        createDependencySchemaAddonTag
                    )
                );
            }
        }
        return container;
    }

    /**
     * Create VP grid
     * @param trustChainConfig Trust chain config
     * @param trustChainTag Trust chain tag
     * @param container Container
     * @returns container
     */
    private createVPGrid(
        trustChainConfig: IWizardTrustChainConfig,
        trustChainTag: string,
        container: any
    ) {
        const vpGrid = this.getVpGrid(
            trustChainConfig.role,
            trustChainTag,
            trustChainConfig.viewOnlyOwnDocuments
        );
        container.children.push(vpGrid);
        return container;
    }

    /**
     * Create trust chain steps
     * @param trustChainConfig Trust chain config
     * @param schemaConfigs Schema configs
     * @param container Container
     * @returns Container
     */
    private putTrustChainStepsIntoContainer(
        trustChainConfig: IWizardTrustChainConfig,
        schemaConfigs: IWizardSchemaConfig[],
        container: any
    ): [tabContainer: any, trustChainBlockTag: string] {
        const findRelatedSchemas = (
            iri: string,
            result: IWizardSchemaConfig[] = []
        ) => {
            const currentSchema = schemaConfigs.find(
                (item) => item.iri === iri
            );
            if (!currentSchema) {
                return result;
            }
            const dependencySchema = schemaConfigs.find(
                (item) => item.dependencySchemaIri === iri
            );
            const relationShipSchema = schemaConfigs.find(
                (item) => item.iri === currentSchema?.relationshipsSchemaIri
            );
            if (dependencySchema && dependencySchema.iri !== iri) {
                result.push(dependencySchema);
                findRelatedSchemas(dependencySchema.iri, result);
            }
            if (relationShipSchema && relationShipSchema.iri !== iri) {
                result.push(relationShipSchema);
                findRelatedSchemas(relationShipSchema.iri, result);
            }
            return result;
        };

        const reportBlock = this.getReportBlock(trustChainConfig.role);
        const mintReportItem = this.getReportMintItem(trustChainConfig.role);
        reportBlock.children.push(mintReportItem);
        const mintSchema = schemaConfigs.find(
            (item) => item.iri === trustChainConfig.mintSchemaIri
        );

        let relationshipsVariableName = '';
        if (mintSchema?.isApproveEnable) {
            let firstReportItemApproved;
            let firstReportItemCreated;
            [firstReportItemApproved, relationshipsVariableName] =
                this.getReportFirstItem(
                    trustChainConfig.role,
                    `${mintSchema.name} approved`,
                    `${mintSchema.name} approved`
                );
            [firstReportItemCreated, relationshipsVariableName] =
                this.getReportItem(
                    trustChainConfig.role,
                    `${mintSchema.name} created`,
                    `${mintSchema.name} created`,
                    relationshipsVariableName
                );
            reportBlock.children.push(
                firstReportItemApproved,
                firstReportItemCreated
            );
        } else if (mintSchema) {
            let firstReportItemCreated;
            [firstReportItemCreated, relationshipsVariableName] =
                this.getReportFirstItem(
                    trustChainConfig.role,
                    `${mintSchema?.name} created`,
                    `${mintSchema?.name} created`
                );
            reportBlock.children.push(firstReportItemCreated);
        }

        const relatedSchemas = findRelatedSchemas(mintSchema?.iri || '');
        for (const relatedSchema of relatedSchemas) {
            if (relatedSchema?.isApproveEnable) {
                let reportItemApproved;
                let reportItemCreated;
                [reportItemApproved, relationshipsVariableName] =
                    this.getReportItem(
                        trustChainConfig.role,
                        `${relatedSchema.name} approved`,
                        `${relatedSchema.name} approved`,
                        relationshipsVariableName
                    );
                [reportItemCreated, relationshipsVariableName] =
                    this.getReportItem(
                        trustChainConfig.role,
                        `${relatedSchema.name} created`,
                        `${relatedSchema.name} created`,
                        relationshipsVariableName
                    );
                reportBlock.children.push(
                    reportItemApproved,
                    reportItemCreated
                );
            } else {
                let reportItemCreated;
                [reportItemCreated, relationshipsVariableName] =
                    this.getReportFirstItem(
                        trustChainConfig.role,
                        `${relatedSchema?.name} created`,
                        `${relatedSchema?.name} created`
                    );
                reportBlock.children.push(reportItemCreated);
            }
        }

        container.children.push(reportBlock);
        return [container, reportBlock.tag];
    }

    /**
     * Get choose role block
     * @param roles Roles
     * @returns Block
     */
    private getChooseRoleBlock(roles: string[]) {
        return {
            id: GenerateUUIDv4(),
            tag: this.generateBlockTag(),
            roles: roles?.filter((role) => role !== 'OWNER'),
            blockType: BlockType.PolicyRoles,
            defaultActive: true,
            children: [],
            permissions: ['NO_ROLE'],
            events: [],
            artifacts: [],
            uiMetaData: {
                title: 'Choose role',
                description: 'Please select your role',
            },
        };
    }

    /**
     * Get Role Container block
     * @param role Role
     * @returns Block
     */
    getRoleContainer(role: string) {
        return {
            id: GenerateUUIDv4(),
            tag: this.generateBlockTag(),
            blockType: BlockType.Container,
            defaultActive: true,
            children: [],
            permissions: [role],
            events: [],
            artifacts: [],
            uiMetaData: {
                type: 'tabs',
            },
        };
    }

    /**
     * Get role step block
     * @param role Role
     * @returns Block
     */
    getRoleStep(role: string) {
        return {
            id: GenerateUUIDv4(),
            tag: this.generateBlockTag(),
            blockType: BlockType.Step,
            defaultActive: true,
            children: [] as any,
            permissions: [role],
            events: [],
            artifacts: [],
        };
    }

    /**
     * Get tab container
     * @param role Role
     * @param title Title
     * @returns Block
     */
    getTabContainer(role: string, title: string) {
        return {
            id: GenerateUUIDv4(),
            tag: this.generateBlockTag(),
            blockType: BlockType.Container,
            defaultActive: true,
            children: [] as any,
            permissions: [role],
            events: [],
            artifacts: [],
            uiMetaData: {
                type: 'blank',
                title,
            },
        };
    }

    /**
     * Get documents grid block
     * @param role Role
     * @param fieldsConfig Fields config
     * @returns Block
     */
    getDocumentsGrid(role: string, fieldsConfig: IGridConfig[]) {
        return {
            id: GenerateUUIDv4(),
            blockType: 'interfaceDocumentsSourceBlock',
            defaultActive: true,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {
                fields: [
                    ...fieldsConfig.map((fieldConfig) =>
                        Object({
                            name:
                                'document.credentialSubject.0.' +
                                fieldConfig.field,
                            title: fieldConfig.title,
                            type: 'text',
                        })
                    ),
                    {
                        name: 'document',
                        title: 'Document',
                        tooltip: '',
                        type: 'button',
                        action: 'dialog',
                        content: 'View Document',
                        uiClass: 'link',
                        dialogContent: 'VC',
                        dialogClass: '',
                        dialogType: 'json',
                    },
                ],
            },
            tag: this.generateBlockTag(),
            children: [this.getHistoryAddon(role)] as any,
        };
    }

    /**
     * Get history addon block
     * @param role Role
     */
    private getHistoryAddon(role: string) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.HistoryAddon,
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get approve/reject send block
     * @param role Role
     * @returns Block
     */
    private getChangeDocumentStatusSendBlock(role: string, status: string) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.SendToGuardian,
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {},
            options: [
                {
                    name: 'status',
                    value: status,
                },
            ],
            stopPropagation: false,
            dataSource: 'database',
            documentType: 'vc',
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get document send block
     * @param role Role
     * @param stopPropagation Stop propagation
     * @param needApprove Is needed to approve
     * @param entityType Entity type
     * @returns Block
     */
    private getDocumentSendBlock(
        role: string,
        stopPropagation: boolean = false,
        needApprove: boolean = false,
        entityType?: string,
        blockTagsToTriggerRunEvent?: string[]
    ) {
        const tag = this.generateBlockTag();
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.SendToGuardian,
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {},
            options: needApprove
                ? [
                      {
                          name: 'status',
                          value: 'Waiting for approval',
                      },
                  ]
                : [],
            dataSource: 'auto',
            documentType: 'vc',
            tag,
            stopPropagation,
            entityType,
            events: Array.isArray(blockTagsToTriggerRunEvent)
                ? blockTagsToTriggerRunEvent.map((target) => ({
                      target,
                      source: tag,
                      input: 'RunEvent',
                      output: 'RunEvent',
                      actor: 'owner',
                      disabled: false,
                  }))
                : [],
        };
    }

    /**
     * Get reassign block
     * @param role Role
     * @param actorIsOwner Is actor owner
     * @returns Block
     */
    private getReassignBlock(role: string, actorIsOwner: boolean = false) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.ReassigningBlock,
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {},
            issuer: '',
            actor: actorIsOwner ? 'owner' : '',
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get buttons block
     * @param role Role
     * @param approveDocumentBlockTag Approve document block tag
     * @param rejectDocumentBlockTag Reject document block tag
     * @returns Block
     */
    private getApproveRejectButtonsBlock(
        role: string,
        approveDocumentBlockTag: string,
        rejectDocumentBlockTag: string
    ) {
        const buttonBlockTag = this.generateBlockTag();
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.ButtonBlock,
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {
                buttons: [
                    {
                        tag: 'Button_0',
                        name: 'Approve',
                        type: 'selector',
                        filters: [],
                        field: 'option.status',
                        value: 'Approved',
                        uiClass: 'btn-approve',
                    },
                    {
                        tag: 'Button_1',
                        name: 'Reject',
                        type: 'selector-dialog',
                        filters: [],
                        field: 'option.status',
                        value: 'Rejected',
                        uiClass: 'btn-reject',
                        title: 'Reject',
                        description: 'Enter reject reason',
                    },
                ],
            },
            tag: buttonBlockTag,
            events: [
                {
                    target: approveDocumentBlockTag,
                    source: buttonBlockTag,
                    input: 'RunEvent',
                    output: 'Button_0',
                    actor: '',
                    disabled: false,
                },
                {
                    target: rejectDocumentBlockTag,
                    source: buttonBlockTag,
                    input: 'RunEvent',
                    output: 'Button_1',
                    actor: '',
                    disabled: false,
                },
            ],
        };
    }

    /**
     * Get approve reject field
     * @param bindBlock Bind block
     * @param bindGroup Bind group
     * @returns Field
     */
    private getApproveRejectField(bindBlock: string, bindGroup: string) {
        return {
            title: 'Operation',
            name: 'option.status',
            tooltip: '',
            type: 'block',
            action: '',
            url: '',
            dialogContent: '',
            dialogClass: '',
            dialogType: '',
            bindBlock,
            width: '250px',
            bindGroup,
        };
    }

    /**
     * Get documents source addon
     * @param role Role
     * @param schema Schema
     * @param onlyOwnDocuments Only own documents
     * @param filters Filters
     * @param dataType Data type
     * @returns Block
     */
    private getDocumentsSourceAddon(
        role: string,
        schema: string,
        onlyOwnDocuments: boolean = false,
        filters: any[] = [],
        dataType: string = 'vc-documents'
    ) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.DocumentsSourceAddon,
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            filters,
            dataType,
            schema,
            onlyOwnDocuments,
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get dialog request
     * @param role Role
     * @param schemaIri Schema iri
     * @param dependencySchema Dependency schema
     * @param schemaName Schema name
     * @returns Block
     */
    getDialogRequestDocumentBlock(
        role: string,
        schemaIri: string,
        dependencySchema: boolean = false,
        schemaName?: string
    ) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.Request,
            defaultActive: !dependencySchema,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {
                type: 'dialog',
                content: 'Create' + (schemaName ? ` ${schemaName}` : ''),
                dialogContent: 'Enter data',
                buttonClass: dependencySchema ? 'link' : '',
            },
            presetFields: [],
            idType: 'UUID',
            schema: schemaIri,
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get request document block
     * @param role Role
     * @param schemaIri Schema iri
     * @returns Block
     */
    private getRequestDocumentBlock(role: string, schemaIri: string) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.Request,
            defaultActive: true,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {
                type: 'page',
                title: 'Enter description',
            },
            schema: schemaIri,
            idType: 'UUID',
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get info block
     * @param role Role
     * @param title Title
     * @param description Description
     * @returns Block
     */
    private getInfoBlock(role: string, title: string, description: string) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.Information,
            defaultActive: true,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {
                description,
                type: 'text',
                title,
            },
            stopPropagation: true,
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get report block
     * @param role Role
     * @returns Block
     */
    private getReportBlock(role: string) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.Report,
            defaultActive: true,
            permissions: [role],
            onErrorAction: 'no-action',
            tag: this.generateBlockTag(),
            children: [] as any,
        };
    }

    /**
     * Get report mint item
     * @param role Role
     * @returns Block
     */
    private getReportMintItem(role: string) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.ReportItem,
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            filters: [
                {
                    type: 'equal',
                    typeValue: 'variable',
                    field: 'document.id',
                    value: 'actionId',
                },
            ],
            variables: [],
            visible: true,
            iconType: 'COMMON',
            title: 'Token',
            description: 'Token[s] minted.',
            dynamicFilters: [],
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get first report item block
     * @param role Role
     * @param title Title
     * @param description Description
     * @returns Block
     */
    private getReportFirstItem(
        role: string,
        title: string,
        description: string
    ): [config: any, relationshipsVariableName: string] {
        const generatedVariableName = GenerateUUIDv4();
        return [
            {
                id: GenerateUUIDv4(),
                blockType: BlockType.ReportItem,
                defaultActive: false,
                permissions: [role],
                onErrorAction: 'no-action',
                filters: [
                    {
                        type: 'equal',
                        typeValue: 'variable',
                        field: 'document.id',
                        value: 'documentId',
                    },
                ],
                variables: [
                    {
                        name: generatedVariableName,
                        value: 'relationships',
                    },
                ],
                visible: true,
                iconType: 'COMMON',
                title,
                description,
                dynamicFilters: [],
                tag: this.generateBlockTag(),
            },
            generatedVariableName,
        ];
    }

    /**
     * Get report item block
     * @param role Role
     * @param title Title
     * @param description Description
     * @param relationshipsVariableName Relationships variable name
     * @returns Block
     */
    private getReportItem(
        role: string,
        title: string,
        description: string,
        relationshipsVariableName: string
    ): [config: any, relationshipsVariableName: string] {
        const generatedVariableName = GenerateUUIDv4();
        return [
            {
                id: GenerateUUIDv4(),
                blockType: BlockType.ReportItem,
                defaultActive: false,
                permissions: [role],
                onErrorAction: 'no-action',
                filters: [
                    {
                        type: 'in',
                        typeValue: 'variable',
                        field: 'messageId',
                        value: relationshipsVariableName,
                    },
                ],
                variables: [
                    {
                        value: 'relationships',
                        name: generatedVariableName,
                    },
                ],
                visible: true,
                iconType: 'COMMON',
                title,
                description,
                dynamicFilters: [],
                tag: this.generateBlockTag(),
            },
            generatedVariableName,
        ];
    }

    /**
     * Get vp grid
     * @param role Role
     * @param trustChainTag Trust Chain tag
     * @param viewAll View all documents
     * @returns Block
     */
    private getVpGrid(
        role: string,
        trustChainTag: string,
        onlyOwnDocuments: boolean
    ) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.DocumentsViewer,
            defaultActive: true,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {
                fields: [
                    {
                        title: 'HASH',
                        name: 'hash',
                        tooltip: '',
                        type: 'text',
                    },
                    {
                        title: 'Date',
                        name: 'document.verifiableCredential.1.credentialSubject.0.date',
                        tooltip: '',
                        type: 'text',
                    },
                    {
                        title: 'Token Id',
                        name: 'document.verifiableCredential.1.credentialSubject.0.tokenId',
                        tooltip: '',
                        type: 'text',
                    },
                    {
                        title: 'Serials',
                        name: 'document.verifiableCredential.1.credentialSubject.0.serials',
                        tooltip: '',
                        type: 'text',
                    },
                    {
                        title: 'TrustChain',
                        name: 'hash',
                        tooltip: '',
                        type: 'button',
                        action: 'link',
                        url: '',
                        dialogContent: '',
                        dialogClass: '',
                        dialogType: '',
                        bindBlock: trustChainTag,
                        content: 'View TrustChain',
                        width: '150px',
                    },
                ],
            },
            tag: this.generateBlockTag(),
            children: [
                this.getDocumentsSourceAddon(
                    role,
                    '',
                    onlyOwnDocuments,
                    [],
                    'vp-documents'
                ),
            ],
        };
    }

    /**
     * Get mint block
     * @param role Role
     * @param tokenId Token Id
     * @param rule Rule
     * @returns Block
     */
    private getMintBlock(role: string, tokenId: string, rule: string) {
        return {
            id: GenerateUUIDv4(),
            blockType: BlockType.Mint,
            stopPropagation: true,
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            uiMetaData: {},
            tokenId,
            rule,
            accountType: 'default',
            tag: this.generateBlockTag(),
        };
    }

    /**
     * Get create depndency schema column
     * @param title Title
     * @param bindBlock Bind block
     * @param bindGroup Bind group
     * @returns Column
     */
    getCreateDependencySchemaColumn(
        title: string,
        bindBlock: string,
        bindGroup: string
    ) {
        return {
            title,
            name: '',
            type: 'block',
            action: '',
            url: '',
            dialogContent: '',
            dialogClass: '',
            dialogType: '',
            bindBlock,
            width: '150px',
            bindGroup,
        };
    }

    /**
     * Get set relationships block
     * @param role Role
     * @param schemaIri Schema iri
     * @param isApproveEnable Is approve enabled
     * @returns Block
     */
    getSetRelationshipsBlock(
        role: string,
        schemaIri: string,
        isApproveEnable: boolean
    ) {
        return {
            id: GenerateUUIDv4(),
            blockType: 'setRelationshipsBlock',
            defaultActive: false,
            permissions: [role],
            onErrorAction: 'no-action',
            includeAccounts: false,
            tag: this.generateBlockTag(),
            children: [
                isApproveEnable
                    ? this.getDocumentsSourceAddon(role, schemaIri, true, [
                          {
                              value: 'approved_entity',
                              field: 'type',
                              type: 'equal',
                          },
                      ])
                    : this.getDocumentsSourceAddon(role, schemaIri, true),
            ],
        };
    }
}
