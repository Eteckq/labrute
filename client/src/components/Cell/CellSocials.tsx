import { AccountTree, MilitaryTech, Person } from '@mui/icons-material';
import { Box, Button, Grid, Paper, PaperProps, Tooltip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBrute } from '../../hooks/useBrute';
import useStateAsync from '../../hooks/useStateAsync';
import Server from '../../utils/Server';
import Link from '../Link';
import Text from '../Text';
import { useAuth } from '../../hooks/useAuth';
import { Link as RouterLink } from 'react-router-dom';

export interface CellSocialsProps extends PaperProps {
  smallScreen?: boolean;
}

const CellSocials = ({
  smallScreen,
  ...rest
}: CellSocialsProps) => {
  const { brute } = useBrute();
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: getter } = useStateAsync(null, Server.Brute.getRanking, brute?.name || '');

  return brute && (
    <Paper {...rest}>
      <Grid container spacing={1}>
        <Grid item xs={smallScreen ? 12 : 6}>
          {/* No achievements for bots */}
          {brute.userId && (
            <Tooltip title={t('achievements')}>
              <Link
                to={`/${brute.name}/achievements`}
                sx={{ mr: 1 }}
              >
                <MilitaryTech color="warning" />
              </Link>
            </Tooltip>
          )}
          {/* No destiny for bots */}
          {brute.userId && (
            <Tooltip title={`${t('destinyOf')} ${brute.name}`}>
              <Link
                to={`/${brute.name}/destiny`}
                sx={{ mr: 1 }}
              >
                <AccountTree color="success" />
              </Link>
            </Tooltip>
          )}
          <Text h2 smallCaps sx={{ display: 'inline-block' }}>{brute.name}</Text>
        </Grid>
        <Grid item xs={smallScreen ? 6 : 3}>
          <Box>
            <Link to={`/${brute.name}/ranking`}>
              <Text bold color="secondary" component="span">{t('ranking')}: </Text>
              <Text bold component="span">
                {getter?.ranking || 'NA'}
              </Text>
            </Link>
          </Box>
          {user?.brutes[0] && (
            <Box>
              <Text bold component="span"><Link to={`/${user?.brutes[0].name}/cell`}>Cellule de {user?.brutes[0].name}</Link></Text>
            </Box>
          )}
        </Grid>
        <Grid item xs={smallScreen ? 6 : 3}>
          <Box>
            <Text bold color="secondary" component="span">{t('victories')}: </Text>
            <Text bold component="span">{brute.victories}</Text>
          </Box>
          <Box>
            <Text bold color="secondary" component="span">{t('gold')}: </Text>
            <Text bold component="span">{user?.gold}</Text>
          </Box>
        </Grid>
      </Grid>
      {brute.user && (
        <Tooltip title={t('userProfile', { user: brute.user.name })}>
          <Button
            component={RouterLink}
            to={`/user/${brute.user.id}`}
            size="small"
            startIcon={<Person fontSize="small" />}
            color="secondary"
          >
            <Text smallCaps subtitle2>{brute.user.name}</Text>
          </Button>
        </Tooltip>
      )}
      {user?.moderator && brute.user && (
        <Text smallCaps subtitle2>{brute.id} | {brute.user.name} ({brute.userId})</Text>
      )}
    </Paper>
  );
};

export default CellSocials;
