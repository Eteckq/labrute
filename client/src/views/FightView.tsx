import { Fight } from '@labrute/prisma';
import { Box, useMediaQuery } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import FightComponent from '../components/Arena/FightComponent';
import BoxBg from '../components/BoxBg';
import Page from '../components/Page';
import { useAlert } from '../hooks/useAlert';
import catchError from '../utils/catchError';
import Server from '../utils/Server';
import FightMobileView from './mobile/FightMobileView';

const FightView = () => {
  const { t } = useTranslation();
  const { bruteName, fightId } = useParams();
  const Alert = useAlert();
  const navigate = useNavigate();
  const smallScreen = useMediaQuery('(max-width: 935px)');

  // Fight data
  const [fight, setFight] = useState<Fight | null>(null);

  // Fetch fight and brutes
  useEffect(() => {
    let isSubscribed = true;
    const cleanup = () => { isSubscribed = false; };

    if (!bruteName || !fightId) {
      navigate('/');
      return cleanup;
    }

    Server.Fight.get(bruteName, +fightId).then((result) => {
      if (isSubscribed) {
        setFight(result);
      }
    }).catch(catchError(Alert));

    return cleanup;
  }, [Alert, bruteName, fightId, navigate]);

  if (smallScreen) {
    return (
      <FightMobileView
        bruteName={bruteName}
        fight={fight}
      />
    );
  }

  return (bruteName && fightId) ? (
    <Page title={`${bruteName || ''} ${t('MyBrute')}`} headerUrl={`/${bruteName}/cell`}>
      <BoxBg
        src="/images/versus/background.gif"
        sx={{
          width: 930,
          height: 460,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* FIGHT */}
        <Box sx={{ ml: -4, alignSelf: 'center' }}>
          <FightComponent fight={fight} />
        </Box>
      </BoxBg>
    </Page>
  ) : null;
};

export default FightView;