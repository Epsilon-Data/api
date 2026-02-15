import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  data: T[];
  pagination: PaginationDto;
}

export class AdminStatsDto {
  @ApiProperty()
  projectCount: number;

  @ApiProperty()
  requestCount: number;

  @ApiProperty()
  commentCount: number;

  @ApiProperty()
  notificationCount: number;

  @ApiProperty()
  pendingRequests: number;

  @ApiProperty()
  approvedRequests: number;

  @ApiProperty({ type: [Object] })
  projectsByStatus: { status: string; count: number }[];
}

export class AdminProjectSummaryDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  customId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  university: string;

  @ApiProperty()
  lead: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  lastModified: Date;

  @ApiProperty()
  createdDate: Date;
}

export class AdminRequestSummaryDto {
  @ApiProperty()
  requestId: string;

  @ApiProperty()
  requestorId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  lastModified: Date;

  @ApiProperty()
  createdDate: Date;

  @ApiProperty({ required: false })
  analysis?: {
    requestorName: string;
    requestorEmail: string;
    projectName: string;
  };

  @ApiProperty()
  _count: {
    comments: number;
  };
}

export class AdminCommentSummaryDto {
  @ApiProperty()
  commentId: string;

  @ApiProperty()
  requestId: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  authorName: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdDate: Date;

  @ApiProperty({ required: false })
  request?: {
    analysis?: {
      projectName: string;
    };
  };
}

export class AdminNotificationSummaryDto {
  @ApiProperty()
  notificationId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  type: number;

  @ApiProperty()
  createdDate: Date;

  @ApiProperty({ type: [Object] })
  NotificationSender: object[];

  @ApiProperty({ type: [Object] })
  NotificationRecipient: object[];
}
