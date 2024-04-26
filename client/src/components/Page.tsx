import { Version } from '@labrute/core';
import { AdminPanelSettings, Login } from '@mui/icons-material';
import { AlertTitle, Box, BoxProps, CircularProgress, Fab, Link, Alert as MuiAlert, Tooltip } from '@mui/material';
import React, { useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAlert } from '../hooks/useAlert';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import useStateAsync from '../hooks/useStateAsync';
import catchError from '../utils/catchError';
import Fetch from '../utils/Fetch';
import Server from '../utils/Server';
import Header from './Header';
import Text from './Text';
import { Lang } from '@labrute/prisma';

interface Props extends BoxProps {
  title: string,
  headerUrl?: string,
  children: React.ReactNode;
  checkServer?: boolean;
  sx?: BoxProps['sx'];
}

const Page = ({
  title,
  headerUrl,
  children,
  checkServer = true,
  sx,
  ...rest
}: Props) => {
  const { t } = useTranslation();
  const Alert = useAlert();
  const { authing, user, signin, updateData } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();

  // Check if server is ready
  const { data: serverState } = useStateAsync(null, Server.isReady, undefined);

  // Auth on page load
  useEffect(() => {
    if (!user && !authing) {
      signin();
    }
  }, [authing, signin, user]);

  // Redirect to waiting page if server is not ready
  useEffect(() => {
    if (serverState === null) return;

    if (checkServer && !serverState.ready) {
      navigate('/generating-tournaments');
    }
  }, [checkServer, navigate, serverState]);

  const oauth = useCallback(() => {
    Fetch<{ url: string }>('/api/oauth/redirect').then(({ url }) => {
      window.location.href = url;
    }).catch(catchError(Alert));
  }, [Alert]);

  // Change language
  const changeLanguage = useCallback((lang: Lang) => () => {
    setLanguage(lang);

    // Update user language if logged in
    if (user && user.lang !== lang) {
      Server.User.changeLanguage(lang).then(() => {
        updateData(({
          ...user,
          lang,
        }));
      }).catch(catchError(Alert));
    }
  }, [Alert, setLanguage, updateData, user]);

  return (
    <Box
      sx={{
        pb: 2,
        ...sx,
      }}
      {...rest}
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>
      {/* HEADER */}
      <Header url={headerUrl} />
      {children}
      {/* AUTH */}
      {!user && (
        <Tooltip title={t('login')}>
          <Fab
            onClick={oauth}
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 101,
              bgcolor: 'success.light',
              '&:hover': { bgcolor: 'success.main' },
            }}
          >
            {authing
              ? <CircularProgress color="success" sx={{ width: '20px !important', height: '20px !important' }} />
              : <Login />}
          </Fab>
        </Tooltip>
      )}
      {/* FOOTER */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Text color="secondary" sx={{ fontWeight: 'bold' }}>
          &copy; 2008{' '}
          <Link href="http://www.motion-twin.com/">
            <Box
              component="img"
              src="/images/motiontwin.gif"
              alt="Motion Twin"
              sx={{ verticalAlign: 'middle' }}
            />
          </Link>
          {' '}| v{Version} Remade with love at{' '}
          <Link href="https://eternal-twin.net/">Eternal Twin</Link>
          {/* LANGUAGE */}
          {Object.values(Lang).map((lang) => lang !== language && (
            <Tooltip title={t(`${lang}-version`)} key={lang}>
              <Box
                component="img"
                src={`/images/${lang}/flag.svg`}
                alt={lang}
                onClick={changeLanguage(lang)}
                sx={{ ml: 1, cursor: 'pointer', width: 15 }}
              />
            </Tooltip>
          ))}
          {/* ADMIN PANEL */}
          {user && user.admin && (
            <Tooltip title={t('adminPanel')}>
              <Link href="/admin-panel" sx={{ ml: 1 }}>
                <AdminPanelSettings sx={{ fontSize: 14 }} />
              </Link>
            </Tooltip>
          )}
        </Text>
      </Box>
      <MuiAlert
        severity="info"
        variant="filled"
        sx={{ mb: 0 }}
      >
        <AlertTitle>Fork LaBrute</AlertTitle>
        Ce projet est un fork du projet
        <Link underline="always" href="https://github.com/Zenoo/labrute" target="_blank" sx={{ ml: 0.5 }}>
          https://github.com/Zenoo/labrute
        </Link>
        , afin de le rendre <span style={{ textDecoration: 'line-through' }}>accessible aux golems</span> jouable via Discord. Le code source est disponible ici
        <Link underline="always" href="https://github.com/Eteckq/labrute/tree/discord" target="_blank" sx={{ ml: 0.5 }}>
          https://github.com/Eteckq/labrute/tree/discord
        </Link>
      </MuiAlert>
    </Box>
  );
};

export default Page;
