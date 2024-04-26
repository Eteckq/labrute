import { Fight } from '@labrute/prisma';
import { Paper } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import FightComponent from '../../components/Arena/FightComponent';
import Page from '../../components/Page';

export interface FightMobileViewProps {
  bruteName: string | undefined;
  fight: Fight | null;
}

const FightMobileView = ({
  bruteName,
  fight,
}: FightMobileViewProps) => {
  const { t } = useTranslation();

  return (
    <Page
      title={`${bruteName || ''} ${t('MyBrute')}`}
      headerUrl={`/${bruteName || ''}/cell`}
    >
      <Paper sx={{ textAlign: 'center' }}>
        {/* FIGHT */}
        <FightComponent fight={fight} />
      </Paper>
    </Page>
  );
};

export default FightMobileView;
