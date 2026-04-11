import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import {
  CompatibilityLevelCompatibilityEnum,
  SchemaType,
} from 'generated-sources';
import {
  clusterSchemaPath,
  clusterSchemasPath,
  ClusterSubjectParam,
} from 'lib/paths';
import yup from 'lib/yupExtended';
import { NewSchemaSubjectRaw } from 'redux/interfaces';
import SchemaToggleEditor from 'components/common/SchemaToggleEditor';
import Select from 'components/common/Select/Select';
import { Button } from 'components/common/Button/Button';
import EditorViewer from 'components/common/EditorViewer/EditorViewer';
import { InputLabel } from 'components/common/Input/InputLabel.styled';
import PageHeading from 'components/common/PageHeading/PageHeading';
import { useAppDispatch, useAppSelector } from 'lib/hooks/redux';
import useAppParams from 'lib/hooks/useAppParams';
import {
  schemaAdded,
  getSchemaLatest,
  getAreSchemaLatestFulfilled,
  schemaUpdated,
  getAreSchemaLatestRejected,
} from 'redux/reducers/schemas/schemasSlice';
import PageLoader from 'components/common/PageLoader/PageLoader';
import { schemasApiClient } from 'lib/api';
import { showServerError } from 'lib/errorHandling';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormError } from 'components/common/Input/Input.styled';
import { ErrorMessage } from '@hookform/error-message';

import * as S from './Edit.styled';

const Form: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { clusterName, subject } = useAppParams<ClusterSubjectParam>();

  const schema = useAppSelector((state) => getSchemaLatest(state));
  const isFetched = useAppSelector(getAreSchemaLatestFulfilled);
  const isRejected = useAppSelector(getAreSchemaLatestRejected);

  const formatedSchema = React.useMemo(() => {
    return schema?.schemaType === SchemaType.PROTOBUF
      ? schema?.schema
      : JSON.stringify(JSON.parse(schema?.schema || '{}'), null, '\t');
  }, [schema]);

  const validationSchema = () =>
    yup.object().shape({
      newSchema:
        schema?.schemaType === SchemaType.PROTOBUF
          ? yup.string().required()
          : yup.string().required().isJsonObject('Schema syntax is not valid'),
    });
  const methods = useForm<NewSchemaSubjectRaw>({
    mode: 'onChange',
    resolver: yupResolver(validationSchema()),
    defaultValues: {
      schemaType: schema?.schemaType,
      compatibilityLevel:
        schema?.compatibilityLevel as CompatibilityLevelCompatibilityEnum,
      newSchema: formatedSchema,
    },
  });

  const {
    formState: { isDirty, isSubmitting, dirtyFields, errors },
    control,
    handleSubmit,
  } = methods;
  const onSubmit = async (props: NewSchemaSubjectRaw) => {
    if (!schema) return;

    try {
      if (dirtyFields.compatibilityLevel) {
        await schemasApiClient.updateSchemaCompatibilityLevel({
          clusterName,
          subject,
          compatibilityLevel: {
            compatibility: props.compatibilityLevel,
          },
        });
        dispatch(
          schemaUpdated({
            ...schema,
            compatibilityLevel: props.compatibilityLevel,
          })
        );
      }
      if (dirtyFields.newSchema || dirtyFields.schemaType) {
        const resp = await schemasApiClient.createNewSchema({
          clusterName,
          newSchemaSubject: {
            ...schema,
            schema: props.newSchema || schema.schema,
            schemaType: props.schemaType || schema.schemaType,
          },
        });
        dispatch(schemaAdded(resp));
      }

      navigate(clusterSchemaPath(clusterName, subject));
    } catch (e) {
      showServerError(e as Response);
    }
  };

  if (isRejected) {
    navigate('/404');
  }

  if (!isFetched || !schema) {
    return <PageLoader />;
  }
  return (
    <FormProvider {...methods}>
      <PageHeading
        text={`${subject} Edit`}
        backText="Schema Registry"
        backTo={clusterSchemasPath(clusterName)}
      />
      <S.EditWrapper>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div>
            <div>
              <InputLabel>Type</InputLabel>
              <Controller
                control={control}
                rules={{ required: true }}
                name="schemaType"
                render={({ field: { name, onChange, value } }) => (
                  <Select
                    name={name}
                    value={value}
                    onChange={onChange}
                    minWidth="100%"
                    disabled
                    options={Object.keys(SchemaType).map((type) => ({
                      value: type,
                      label: type,
                    }))}
                  />
                )}
              />
            </div>

            <div>
              <InputLabel>Compatibility level</InputLabel>
              <Controller
                control={control}
                name="compatibilityLevel"
                render={({ field: { name, onChange, value } }) => (
                  <Select
                    name={name}
                    value={value}
                    onChange={onChange}
                    minWidth="100%"
                    disabled={isSubmitting}
                    options={Object.keys(
                      CompatibilityLevelCompatibilityEnum
                    ).map((level) => ({ value: level, label: level }))}
                  />
                )}
              />
            </div>
          </div>
          <S.EditorsWrapper>
            <div>
              <S.EditorContainer>
                <h4>Latest schema</h4>
                <EditorViewer
                  data={formatedSchema || ''}
                  schemaType={schema?.schemaType}
                  maxLines={20}
                />
              </S.EditorContainer>
            </div>
            <div>
              <S.EditorContainer>
                <h4>New schema</h4>
                <Controller
                  control={control}
                  name="newSchema"
                  render={({ field: { name, onChange, value } }) => (
                    <SchemaToggleEditor
                      name={name}
                      value={value || ''}
                      onChange={onChange}
                      schemaType={schema?.schemaType}
                      readOnly={isSubmitting}
                    />
                  )}
                />
              </S.EditorContainer>
              <FormError>
                <ErrorMessage errors={errors} name="newSchema" />
              </FormError>
              <Button
                buttonType="primary"
                buttonSize="M"
                type="submit"
                disabled={!isDirty || isSubmitting || !!errors.newSchema}
              >
                Submit
              </Button>
            </div>
          </S.EditorsWrapper>
        </form>
      </S.EditWrapper>
    </FormProvider>
  );
};

export default Form;
